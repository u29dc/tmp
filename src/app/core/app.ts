import { reportRuntimeError } from "@/app/core/logger";
import type { Context, Frame, Module } from "@/app/core/module";
import type { DeviceProfile, InputState, RouteState, ScrollState } from "@/app/core/state";
import { cancelRuntimeTimers, setTimerScheduler } from "@/app/core/timer";
import { setDataset } from "@/app/utils/dom";

export type AppConfig = {
	getInput: () => InputState;
	getProfile: () => DeviceProfile;
	getRoute: () => RouteState;
	getScroll: () => ScrollState;
	beforeFrame?: readonly FrameStage[];
	afterFrame?: readonly FrameStage[];
	profile?: <T>(label: string, callback: () => T) => T;
	shouldRunContinuously?: () => boolean;
};

export type FrameStage = {
	readonly name: string;
	run: (frame: Frame) => void;
};

type PendingCallback = {
	name: string;
	callback: () => void;
	cancelled: boolean;
};

type RuntimeFaultKind = "frame" | "module" | "runtime" | "scheduler";

type RuntimeSlot = {
	key: string;
	name: string;
	kind: RuntimeFaultKind;
};

type RuntimeTrace = {
	name: string;
	kind: RuntimeFaultKind;
	lastError?: string;
	consecutiveErrors: number;
	quarantined: boolean;
};

const MAX_DELTA_MS = 64;
const MAX_CONSECUTIVE_RECURRING_ERRORS = 3;
const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

export class App {
	private readonly modules: readonly Module[];
	private readonly config: AppConfig;
	private readonly faults = new Map<string, RuntimeTrace>();
	private readonly pendingCallbacks: PendingCallback[] = [];
	private context: Context | undefined;
	private rafId = 0;
	private started = false;
	private ticking = false;
	private requestedDuringTick = false;
	private frameIndex = 0;
	private lastTime = 0;
	private lastReason = "start";
	private resetTimerScheduler: (() => void) | undefined;

	constructor(modules: readonly Module[], config: AppConfig) {
		this.modules = modules;
		this.config = config;
		for (const module of modules) {
			if (module.update) this.registerSlot(moduleUpdateSlot(module));
		}
		for (const stage of config.beforeFrame ?? []) this.registerSlot(frameStageSlot(stage));
		for (const stage of config.afterFrame ?? []) this.registerSlot(frameStageSlot(stage));
		if (config.shouldRunContinuously) this.registerSlot(CONTINUOUS_SCHEDULER_SLOT);
	}

	start(): void {
		if (!isBrowser || this.started) return;
		setDataset(document.documentElement, "runtime", "booting");
		this.started = true;
		this.context = this.createContext();
		this.resetTimerScheduler = setTimerScheduler((name, callback) => {
			this.nextFrame(name, callback);
		});

		for (const module of this.modules) this.runLifecycle(module, "preInit");
		for (const module of this.modules) this.runLifecycle(module, "init");
		for (const module of this.modules) this.runLifecycle(module, "resize");

		window.addEventListener("resize", this.handleResize, { passive: true });
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
		setDataset(document.documentElement, "runtime", "ready");
		setDataset(document.documentElement, "runtimeVisible", String(document.visibilityState === "visible"));
		this.requestFrame("app:start");
	}

	dispose(): void {
		if (!this.started) return;
		this.started = false;
		try {
			if (this.rafId !== 0) {
				cancelAnimationFrame(this.rafId);
				this.rafId = 0;
			}
			window.removeEventListener("resize", this.handleResize);
			document.removeEventListener("visibilitychange", this.handleVisibilityChange);
			for (const module of [...this.modules].toReversed()) this.runDispose(module);
			this.pendingCallbacks.length = 0;
			cancelRuntimeTimers();
		} catch (error) {
			this.recordError({ name: "dispose" }, error);
		} finally {
			this.resetTimerScheduler?.();
			this.resetTimerScheduler = undefined;
			this.resetRecurringFailures();
			this.ticking = false;
			this.requestedDuringTick = false;
			this.lastTime = 0;
		}
	}

	refreshPage(reason = "route:refresh"): void {
		if (!this.started) return;
		this.resetRecurringFailures();
		setDataset(document.documentElement, "runtime", "ready");
		setDataset(document.documentElement, "runtimeVisible", String(document.visibilityState === "visible"));
		for (const module of this.modules) this.runLifecycle(module, "refresh");
		for (const module of this.modules) this.runLifecycle(module, "resize");
		this.requestFrame(reason);
	}

	requestFrame(reason = "request"): void {
		this.lastReason = reason;
		if (!isBrowser || !this.started || document.visibilityState !== "visible") return;
		if (this.ticking) {
			this.requestedDuringTick = true;
			return;
		}
		if (this.rafId !== 0) return;
		this.rafId = requestAnimationFrame(this.tick);
	}

	nextFrame(reason: string, callback: () => void): () => void {
		const pending = { name: reason, callback, cancelled: false };
		this.pendingCallbacks.push(pending);
		this.requestFrame(reason);
		return () => {
			pending.cancelled = true;
		};
	}

	getState(): { started: boolean; running: boolean; frame: number; reason: string } {
		return {
			started: this.started,
			running: this.rafId !== 0,
			frame: this.frameIndex,
			reason: this.lastReason,
		};
	}

	getTrace(): RuntimeTrace[] {
		return Array.from(this.faults.values(), (trace) => ({ ...trace }));
	}

	private createContext(): Context {
		return Object.defineProperties(
			{
				root: document,
				requestFrame: (reason?: string) => this.requestFrame(reason),
				nextFrame: (reason: string, callback: () => void) => this.nextFrame(reason, callback),
				reportError: (name: string, error: unknown) => this.recordError({ name }, error),
			},
			{
				profile: { get: () => this.config.getProfile() },
				route: { get: () => this.config.getRoute() },
				input: { get: () => this.config.getInput() },
				scroll: { get: () => this.config.getScroll() },
			},
		) as Context;
	}

	private createFrame(timestamp: number): Frame {
		const rawdt = this.lastTime === 0 ? 0 : timestamp - this.lastTime;
		const frameIndex = this.frameIndex + 1;
		const profile = this.config.getProfile();
		const route = this.config.getRoute();
		const input = this.config.getInput();
		const scroll = this.config.getScroll();
		this.lastTime = timestamp;
		this.frameIndex = frameIndex;

		return {
			index: frameIndex,
			now: timestamp,
			rawdt,
			dt: Math.min(Math.max(rawdt, 0), MAX_DELTA_MS) / 1000,
			visible: document.visibilityState === "visible",
			profile,
			route,
			input,
			scroll,
		};
	}

	private runLifecycle(module: Module, method: "preInit" | "init" | "refresh" | "resize"): void {
		const callback = module[method];
		if (!callback || !this.context) return;
		try {
			callback.call(module, this.context);
		} catch (error) {
			this.recordError(module, error);
		}
	}

	private runDispose(module: Module): void {
		try {
			module.dispose?.();
		} catch (error) {
			this.recordError(module, error);
		}
	}

	private runPendingCallbacks(): void {
		const callbacks = this.pendingCallbacks.splice(0);
		for (const pending of callbacks) {
			if (pending.cancelled) continue;
			try {
				pending.callback();
			} catch (error) {
				this.recordError({ name: pending.name }, error);
			}
		}
	}

	private recordError(module: Pick<Module, "name">, error: unknown): void {
		const report = reportRuntimeError(module.name, error);
		const trace = this.getTraceFor(runtimeSlot(module.name));
		trace.lastError = report.message;
	}

	private runRecurring(slot: RuntimeSlot, callback: () => boolean | void): boolean | void {
		const trace = this.getTraceFor(slot);
		if (trace.quarantined) return;
		try {
			const result = callback();
			trace.consecutiveErrors = 0;
			return result;
		} catch (error) {
			const report = reportRuntimeError(slot.name, error);
			trace.lastError = report.message;
			trace.consecutiveErrors += 1;
			this.quarantineAfterRepeatedFailures(slot, trace);
		}
	}

	private quarantineAfterRepeatedFailures(slot: RuntimeSlot, trace: RuntimeTrace): void {
		const consecutiveErrors = trace.consecutiveErrors;
		if (consecutiveErrors < MAX_CONSECUTIVE_RECURRING_ERRORS) return;
		trace.quarantined = true;
		const report = reportRuntimeError(`${slot.name}.quarantine`, new Error(`${slot.name} quarantined after ${consecutiveErrors} consecutive failures`));
		trace.lastError = report.message;
	}

	private runFrameStages(stages: readonly FrameStage[] | undefined, frame: Frame): void {
		for (const stage of stages ?? []) this.runRecurring(frameStageSlot(stage), () => stage.run(frame));
	}

	private registerSlot(slot: RuntimeSlot): void {
		if (this.faults.has(slot.key)) throw new Error(`Duplicate runtime slot: ${slot.name}`);
		this.faults.set(slot.key, createRuntimeTrace(slot));
	}

	private getTraceFor(slot: RuntimeSlot): RuntimeTrace {
		const existing = this.faults.get(slot.key);
		if (existing) return existing;
		const trace = createRuntimeTrace(slot);
		this.faults.set(slot.key, trace);
		return trace;
	}

	private resetRecurringFailures(): void {
		for (const trace of this.faults.values()) {
			trace.consecutiveErrors = 0;
			trace.quarantined = false;
		}
	}

	private readonly tick = (timestamp: number): void => {
		this.rafId = 0;
		if (!this.started || document.visibilityState !== "visible") return;
		this.ticking = true;
		this.requestedDuringTick = false;

		let needsNextFrame = false;
		let shouldContinue = false;
		try {
			const frame = this.createFrame(timestamp);

			this.runFrameStages(this.config.beforeFrame, frame);

			this.runPendingCallbacks();
			for (const module of this.modules) {
				if (!module.update) continue;
				const result = this.runRecurring(moduleUpdateSlot(module), () => {
					const update = (): boolean | void => module.update?.(frame);
					return this.config.profile ? this.config.profile(module.name, update) : update();
				});
				needsNextFrame = result === true || needsNextFrame;
			}

			this.runFrameStages(this.config.afterFrame, frame);
		} catch (error) {
			this.recordError({ name: "frame" }, error);
		} finally {
			try {
				const continuous = this.config.shouldRunContinuously !== undefined && this.runRecurring(CONTINUOUS_SCHEDULER_SLOT, () => this.config.shouldRunContinuously?.() === true) === true;
				shouldContinue = continuous || needsNextFrame || this.requestedDuringTick || this.pendingCallbacks.some((callback) => !callback.cancelled);
			} finally {
				this.ticking = false;
				if (!shouldContinue) this.lastTime = 0;
			}
		}
		if (shouldContinue) this.requestFrame(this.lastReason);
	};

	private readonly handleResize = (): void => {
		for (const module of this.modules) this.runLifecycle(module, "resize");
		this.requestFrame("window:resize");
	};

	private readonly handleVisibilityChange = (): void => {
		this.lastTime = 0;
		setDataset(document.documentElement, "runtimeVisible", String(document.visibilityState === "visible"));
		if (document.visibilityState === "visible") this.requestFrame("document:visibility");
	};
}

const CONTINUOUS_SCHEDULER_SLOT: RuntimeSlot = {
	key: "scheduler:continuous",
	name: "scheduler.continuous",
	kind: "scheduler",
};

const moduleUpdateSlot = (module: Module): RuntimeSlot => ({
	key: `module:${module.name}.update`,
	name: `${module.name}.update`,
	kind: "module",
});

const frameStageSlot = (stage: FrameStage): RuntimeSlot => ({
	key: `frame:${stage.name}`,
	name: stage.name,
	kind: "frame",
});

const runtimeSlot = (name: string): RuntimeSlot => ({
	key: `runtime:${name}`,
	name,
	kind: "runtime",
});

const createRuntimeTrace = (slot: RuntimeSlot): RuntimeTrace => ({
	name: slot.name,
	kind: slot.kind,
	consecutiveErrors: 0,
	quarantined: false,
});
