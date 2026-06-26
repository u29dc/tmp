import type { DeviceProfile, InputState, RouteState, ScrollState } from "@/app/core/state";

export type Frame = {
	index: number;
	now: number;
	rawdt: number;
	dt: number;
	visible: boolean;
	profile: DeviceProfile;
	route: RouteState;
	input: InputState;
	scroll: ScrollState;
};

export type Context = {
	root: Document;
	get profile(): DeviceProfile;
	get route(): RouteState;
	get input(): InputState;
	get scroll(): ScrollState;
	requestFrame: (reason?: string) => void;
	nextFrame: (reason: string, callback: () => void) => () => void;
};

export type Module = {
	readonly name: string;
	preInit?: (context: Context) => void;
	init?: (context: Context) => void;
	refresh?: (context: Context) => void;
	resize?: (context: Context) => void;
	update?: (frame: Frame) => boolean | void;
	dispose?: () => void;
};

export abstract class BaseModule implements Module {
	abstract readonly name: string;

	protected context: Context | undefined;
	protected cleanups: Array<() => void> = [];

	preInit(context: Context): void {
		this.context = context;
	}

	init(_context: Context): void {}

	refresh(_context: Context): void {}

	resize(_context: Context): void {}

	update(_frame: Frame): boolean | void {}

	dispose(): void {
		for (const cleanup of this.cleanups.splice(0)) cleanup();
		this.context = undefined;
	}

	protected addCleanup(cleanup: () => void): void {
		this.cleanups.push(cleanup);
	}

	protected requestFrame(reason?: string): void {
		this.context?.requestFrame(reason ?? this.name);
	}

	protected nextFrame(reason: string, callback: () => void): () => void {
		return this.context?.nextFrame(reason, callback) ?? (() => {});
	}
}
