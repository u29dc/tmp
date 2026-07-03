import type { BooleanFlag } from "@/app/core/flags";
import { createDevPane, type DevPane } from "@/app/dev/pane";

export type DevTools = {
	sync: () => void;
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
		dispose,
	};
};
