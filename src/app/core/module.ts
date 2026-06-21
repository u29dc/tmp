import type { DeviceProfile, InputState, RouteState, ScrollState } from "@/app/core/state";

export type Frame = {
	index: number;
	now: number;
	rawdt: number;
	dt: number;
	visible: boolean;
	profile: DeviceProfile;
	input: InputState;
	scroll: ScrollState;
};

export type Context = {
	root: Document;
	profile: DeviceProfile;
	input: InputState;
	scroll: ScrollState;
	route: RouteState;
};

export type Module = {
	readonly name: string;
	preInit?: (context: Context) => void;
	init?: (context: Context) => void;
	resize?: (context: Context) => void;
	update?: (frame: Frame) => void;
	dispose?: () => void;
};

export abstract class BaseModule implements Module {
	abstract readonly name: string;

	protected context?: Context;
	protected cleanups: Array<() => void> = [];

	preInit(context: Context): void {
		this.context = context;
	}

	init(_context: Context): void {}

	resize(_context: Context): void {}

	update(_frame: Frame): void {}

	dispose(): void {
		for (const cleanup of this.cleanups.splice(0)) cleanup();
	}

	protected addCleanup(cleanup: () => void): void {
		this.cleanups.push(cleanup);
	}
}
