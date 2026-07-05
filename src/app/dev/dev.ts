import type { BooleanFlag } from "@/app/core/flags";
import { createDevPane, type DevPane } from "@/app/dev/pane";

export type DevTools = {
	sync: () => void;
	beginFrame: (time: number) => void;
	endFrame: () => void;
	profile: <T>(label: string, callback: () => T) => T;
	renderFrame: (time: number) => void;
	dispose: () => void;
};

export const createDevTools = (flag: BooleanFlag): DevTools => {
	let pane: DevPane | undefined;

	const dispose = (): void => {
		pane?.dispose();
		pane = undefined;
	};

	const mount = (): void => {
		if (pane?.element.isConnected) return;
		dispose();
		pane = createDevPane();
	};

	return {
		sync(): void {
			const state = flag.sync();
			if (state.enabled) mount();
			else dispose();
		},
		beginFrame(time): void {
			pane?.beginFrame(time);
		},
		endFrame(): void {
			pane?.endFrame();
		},
		profile(label, callback) {
			return pane ? pane.profile(label, callback) : callback();
		},
		renderFrame(time): void {
			pane?.renderFrame(time);
		},
		dispose,
	};
};
