import { App } from "@/app/core/app";
import { loadSettingsDraft } from "@/app/core/draft";
import { createBooleanFlag } from "@/app/core/flags";
import { storageKey } from "@/app/core/namespace";
import { applyQuerySettings, resetSettings } from "@/app/core/settings";
import { createDevTools } from "@/app/dev/dev";
import { device, getDeviceProfile } from "@/app/systems/device";
import { input, getInputState } from "@/app/systems/input";
import { motion } from "@/app/systems/motion";
import { performanceMonitor } from "@/app/systems/performance";
import { getRouteState, onRouteAfterSwap, route } from "@/app/systems/route";
import { getScrollState, scroll } from "@/app/systems/scroll";
import { theme } from "@/app/systems/theme";
import { ui } from "@/app/ui/ui";

const controlsFlag = createBooleanFlag({
	param: "controls",
	storageKey: storageKey("controls"),
	persistence: "session",
	defaultValue: import.meta.env.DEV,
});

resetSettings();
if (controlsFlag.sync().enabled) loadSettingsDraft();
applyQuerySettings();

const modules = [device, theme, route, input, scroll, motion, performanceMonitor, ui] as const;

const app = new App(modules, {
	getInput: getInputState,
	getProfile: getDeviceProfile,
	getRoute: getRouteState,
	getScroll: getScrollState,
	beforeFrame: (frame) => performanceMonitor.beginFrame(frame),
	afterFrame: (frame) => {
		input.postUpdate(frame);
		performanceMonitor.endFrame(frame);
	},
});

const devTools = createDevTools(controlsFlag);

app.start();
devTools.sync();
onRouteAfterSwap(() => {
	app.refreshPage("route:after-swap");
	queueMicrotask(() => devTools.sync());
});
