import type { App } from "@/app/core/app";
import { createDevPane } from "@/app/dev/pane";

type DevWindow = Window & {
	__templateDevPaneDispose?: () => void;
};

export const initDevTools = (app: App): void => {
	void app;
	const devWindow = window as DevWindow;
	devWindow.__templateDevPaneDispose?.();
	devWindow.__templateDevPaneDispose = createDevPane();
};
