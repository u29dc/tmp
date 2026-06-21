import type { Context, Frame, Module } from "@/app/core/module";
import type { InputState, RouteState, ScrollState } from "@/app/core/state";

export type AppModules = {
	device: Module;
	theme: Module;
	route: Module;
	input: Module & { postUpdate?: (frame: Frame) => void };
	scroll: Module;
	motion: Module;
	performance: Module & {
		beginFrame?: (frame: Frame) => void;
		endFrame?: (frame: Frame) => void;
	};
	ui: Module;
};

export type AppConfig = {
	getInput: () => InputState;
	getProfile: () => Context["profile"];
	getRoute: () => RouteState;
	getScroll: () => ScrollState;
};

const MAX_DELTA_MS = 64;

const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

export class App {
	private rafId = 0;
	private started = false;
	private frameIndex = 0;
	private lastTime = 0;
	private readonly modules: AppModules;
	private readonly config: AppConfig;

	constructor(modules: AppModules, config: AppConfig) {
		this.modules = modules;
		this.config = config;
	}

	start(): void {
		if (!isBrowser || this.started) return;
		document.documentElement.dataset["runtime"] = "booting";
		this.preInit();
		this.init();
		this.resize();
		window.addEventListener("resize", this.resize, { passive: true });
		document.addEventListener("visibilitychange", this.handleVisibilityChange);
		this.started = true;
		document.documentElement.dataset["runtime"] = "ready";
		this.startLoop();
	}

	dispose(): void {
		if (!isBrowser) return;
		this.started = false;
		this.stopLoop();
		window.removeEventListener("resize", this.resize);
		document.removeEventListener("visibilitychange", this.handleVisibilityChange);
		this.modules.ui.dispose?.();
		this.modules.performance.dispose?.();
		this.modules.motion.dispose?.();
		this.modules.scroll.dispose?.();
		this.modules.input.dispose?.();
		this.modules.route.dispose?.();
		this.modules.device.dispose?.();
		this.modules.theme.dispose?.();
	}

	refreshPage(): void {
		if (!isBrowser || !this.started) return;
		document.documentElement.dataset["runtime"] = "ready";
		document.documentElement.dataset["runtimeVisible"] = String(
			document.visibilityState === "visible",
		);
		this.resize();
	}

	private preInit(): void {
		const context = this.createContext();
		this.modules.device.preInit?.(context);
		this.modules.theme.preInit?.(context);
		this.modules.route.preInit?.(context);
		this.modules.input.preInit?.(context);
		this.modules.scroll.preInit?.(context);
		this.modules.motion.preInit?.(context);
		this.modules.performance.preInit?.(context);
		this.modules.ui.preInit?.(context);
	}

	private init(): void {
		const context = this.createContext();
		this.modules.device.init?.(context);
		this.modules.theme.init?.(context);
		this.modules.route.init?.(context);
		this.modules.input.init?.(context);
		this.modules.scroll.init?.(context);
		this.modules.motion.init?.(context);
		this.modules.performance.init?.(context);
		this.modules.ui.init?.(context);
	}

	private readonly resize = (): void => {
		const context = this.createContext();
		this.modules.device.resize?.(context);
		this.modules.theme.resize?.(context);
		this.modules.route.resize?.(context);
		this.modules.input.resize?.(context);
		this.modules.scroll.resize?.(context);
		this.modules.motion.resize?.(context);
		this.modules.performance.resize?.(context);
		this.modules.ui.resize?.(context);
	};

	private update(frame: Frame): void {
		this.modules.performance.beginFrame?.(frame);
		this.modules.device.update?.(frame);
		this.modules.theme.update?.(frame);
		this.modules.route.update?.(frame);
		this.modules.input.update?.(frame);
		frame.input = this.config.getInput();
		this.modules.scroll.update?.(frame);
		frame.scroll = this.config.getScroll();
		this.modules.motion.update?.(frame);
		this.modules.ui.update?.(frame);
		this.modules.performance.update?.(frame);
		this.modules.input.postUpdate?.(frame);
		this.modules.performance.endFrame?.(frame);
	}

	private readonly loop = (timestamp: number): void => {
		if (!this.started || document.visibilityState !== "visible") return;
		this.rafId = 0;
		const rawdt = this.lastTime === 0 ? 0 : timestamp - this.lastTime;
		const dt = Math.min(Math.max(rawdt, 0), MAX_DELTA_MS) / 1000;
		this.lastTime = timestamp;
		this.frameIndex += 1;
		this.update(this.createFrame(timestamp, rawdt, dt));
		this.startLoop();
	};

	private startLoop(): void {
		if (!this.started || this.rafId || document.visibilityState !== "visible") return;
		this.rafId = requestAnimationFrame(this.loop);
	}

	private stopLoop(): void {
		if (!this.rafId) return;
		cancelAnimationFrame(this.rafId);
		this.rafId = 0;
		this.lastTime = 0;
	}

	private createFrame(timestamp: number, rawdt: number, dt: number): Frame {
		return {
			index: this.frameIndex,
			now: timestamp,
			rawdt,
			dt,
			visible: document.visibilityState === "visible",
			profile: this.config.getProfile(),
			input: this.config.getInput(),
			scroll: this.config.getScroll(),
		};
	}

	private createContext(): Context {
		const thisConfig = this.config;
		return {
			root: document,
			get profile() {
				return thisConfig.getProfile();
			},
			get input() {
				return thisConfig.getInput();
			},
			get scroll() {
				return thisConfig.getScroll();
			},
			get route() {
				return thisConfig.getRoute();
			},
		};
	}

	private readonly handleVisibilityChange = (): void => {
		if (document.visibilityState === "visible") this.startLoop();
		else this.stopLoop();
		document.documentElement.dataset["runtimeVisible"] = String(
			document.visibilityState === "visible",
		);
	};

	getState(): { running: boolean; frame: number } {
		return {
			running: this.started && this.rafId !== 0,
			frame: this.frameIndex,
		};
	}
}
