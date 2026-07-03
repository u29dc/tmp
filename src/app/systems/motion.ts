import { BaseModule, type Context, type Frame } from "@/app/core/module";
import { settings } from "@/app/core/settings";
import { delayTimer, setTimer, type TimerHandle } from "@/app/core/timer";
import { removeDataset, setDataset } from "@/app/utils/dom";
import {
	onRouteAbort,
	onRouteAfterSwap,
	onRouteBeforeSwap,
	onRouteLoad,
	onRoutePreparation,
} from "@/app/systems/route";

export type MotionHandle = {
	readonly name: string;
	cancel: () => void;
};

export type MotionStep = {
	name: string;
	delayMs?: number;
	run?: () => void | Promise<void>;
};

class Motion extends BaseModule {
	readonly name = "motion";

	private routeHandle: MotionHandle | undefined;
	private handles = new Set<MotionHandle>();

	override preInit(context: Context): void {
		super.preInit(context);
		this.bindRoute();
	}

	override init(context: Context): void {
		super.init(context);
		this.applyReadyState();
	}

	override resize(context: Context): void {
		super.resize(context);
	}

	override update(frame: Frame): void {
		super.update(frame);
	}

	override dispose(): void {
		this.cancelAll();
		super.dispose();
	}

	queueFrame(name: string, callback: () => void): MotionHandle {
		let handle: MotionHandle | undefined;
		const cancelFrame = this.nextFrame(`motion.${name}`, () => {
			if (handle) this.handles.delete(handle);
			callback();
		});
		handle = this.createHandle(name, cancelFrame);
		return handle;
	}

	delay(name: string, milliseconds: number, callback?: () => void): MotionHandle {
		let handle: MotionHandle | undefined;
		let timer: TimerHandle | undefined;
		timer = setTimer(name, this.readDuration(milliseconds), () => {
			if (handle) this.handles.delete(handle);
			callback?.();
		});
		handle = this.createHandle(name, () => timer?.cancel());
		return handle;
	}

	runSequence(name: string, steps: MotionStep[]): MotionHandle {
		let cancelled = false;
		const controller = new AbortController();
		const handle = this.createHandle(name, () => {
			cancelled = true;
			controller.abort();
		});
		void (async () => {
			try {
				for (const step of steps) {
					if (cancelled) break;
					if (step.delayMs && step.delayMs > 0)
						await this.wait(step.delayMs, controller.signal);
					if (cancelled) break;
					await step.run?.();
				}
			} catch (error) {
				if (!cancelled && !controller.signal.aborted) {
					this.reportError(`motion.${name}`, error);
				}
			} finally {
				this.handles.delete(handle);
			}
		})();
		return handle;
	}

	private bindRoute(): void {
		this.addCleanup(onRoutePreparation(this.handleRoutePreparation));
		this.addCleanup(onRouteBeforeSwap(this.handleRouteBeforeSwap));
		this.addCleanup(onRouteAfterSwap(this.handleRouteAfterSwap));
		this.addCleanup(onRouteLoad(this.handleRouteLoad));
		this.addCleanup(onRouteAbort(this.handleRouteAbort));
	}

	private applyReadyState(): void {
		const root = document.documentElement;
		setDataset(root, "motion", this.canAnimate() ? "ready" : "reduced");
		setDataset(root, "pageState", "idle");
	}

	private canAnimate(): boolean {
		const profile = this.context?.profile;
		return Boolean(profile && !profile.reducedMotion && profile.motionQuality !== "reduced");
	}

	private readDuration(milliseconds: number): number {
		return this.canAnimate() ? milliseconds : 0;
	}

	private wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
		const duration = this.readDuration(milliseconds);
		if (duration <= 0 || signal?.aborted) return Promise.resolve();
		return delayTimer("motion.wait", duration, signal);
	}

	private createHandle(name: string, cancelCallback: () => void): MotionHandle {
		const handle: MotionHandle = {
			name,
			cancel: () => {
				cancelCallback();
				this.handles.delete(handle);
			},
		};
		this.handles.add(handle);
		return handle;
	}

	private clearRouteHandle(): void {
		this.routeHandle?.cancel();
		this.routeHandle = undefined;
	}

	private cancelAll(): void {
		for (const handle of Array.from(this.handles)) handle.cancel();
		this.handles.clear();
	}

	private readonly handleRoutePreparation = async (event: {
		id: number;
		signal: AbortSignal;
	}): Promise<void> => {
		this.clearRouteHandle();
		const root = document.documentElement;
		setDataset(root, "pageState", "exiting");
		setDataset(root, "routeMotion", "exiting");
		await this.wait(settings.motion.routeExitMs, event.signal);
	};

	private readonly handleRouteBeforeSwap = (): void => {
		const root = document.documentElement;
		setDataset(root, "pageState", "swapping");
		setDataset(root, "routeMotion", "swapping");
	};

	private readonly handleRouteAfterSwap = (): void => {
		const root = document.documentElement;
		setDataset(root, "pageState", "entering");
		setDataset(root, "routeMotion", "entering");
		this.routeHandle = this.queueFrame("route.enter", () => {
			this.routeHandle = this.delay(
				"route.enter.complete",
				settings.motion.routeEnterMs,
				() => {
					setDataset(document.documentElement, "pageState", "idle");
					removeDataset(document.documentElement, "routeMotion");
					this.routeHandle = undefined;
				},
			);
		});
	};

	private readonly handleRouteLoad = (): void => {
		if (this.routeHandle) return;
		if (document.documentElement.dataset["pageState"] === "idle") return;
		this.routeHandle = this.delay("route.load.idle", settings.motion.routeBufferMs, () => {
			setDataset(document.documentElement, "pageState", "idle");
			removeDataset(document.documentElement, "routeMotion");
			this.routeHandle = undefined;
		});
	};

	private readonly handleRouteAbort = (): void => {
		this.clearRouteHandle();
		setDataset(document.documentElement, "pageState", "idle");
		removeDataset(document.documentElement, "routeMotion");
	};
}

export const motion = new Motion();
export const nextMotionFrame = (name: string, callback: () => void): MotionHandle =>
	motion.queueFrame(name, callback);
export const delayMotion = (
	name: string,
	milliseconds: number,
	callback?: () => void,
): MotionHandle => motion.delay(name, milliseconds, callback);
export const runMotionSequence = (name: string, steps: MotionStep[]): MotionHandle =>
	motion.runSequence(name, steps);
