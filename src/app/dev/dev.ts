import type { App } from "@/app/core/app";
import { createDevPane } from "@/app/dev/pane";
import { onRouteAfterSwap } from "@/app/systems/route";

type DevWindow = Window & {
	__templateDevToolsDispose?: () => void;
};

export const initDevTools = (app: App): void => {
	void app;
	const devWindow = window as DevWindow;
	devWindow.__templateDevToolsDispose?.();

	let disposePane = createDevPane();
	const refreshPane = (): void => {
		disposePane();
		disposePane = createDevPane();
	};
	const disposeRoute = onRouteAfterSwap(refreshPane);

	devWindow.__templateDevToolsDispose = () => {
		disposeRoute();
		disposePane();
	};
};
