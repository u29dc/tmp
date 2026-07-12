import { App } from "@/app/core/app";
import { flushSettingsDraftSave, loadSettingsDraft } from "@/app/core/draft";
import { createBooleanFlag } from "@/app/core/flags";
import { storageKey } from "@/app/core/namespace";
import { applyQuerySettings, resetSettings, settings } from "@/app/core/settings";
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
	defaultValue: true,
});

const reconcileSettings = (search = window.location.search, flushDraft = false): void => {
	if (flushDraft) flushSettingsDraftSave();
	resetSettings();
	if (controlsFlag.sync(search).enabled) loadSettingsDraft();
	applyQuerySettings(search);
};

reconcileSettings();

const modules = [device, theme, route, input, scroll, motion, performanceMonitor, ui] as const;
const devTools = createDevTools(controlsFlag);

const app = new App(modules, {
	getInput: getInputState,
	getProfile: getDeviceProfile,
	getRoute: getRouteState,
	getScroll: getScrollState,
	beforeFrame: [
		{
			name: "devtools.begin",
			run: (frame) => devTools.beginFrame(frame.now),
		},
		{
			name: "performance.begin",
			run: (frame) => devTools.profile("performance.begin", () => performanceMonitor.beginFrame(frame)),
		},
	],
	afterFrame: [
		{
			name: "input.post-update",
			run: (frame) => input.postUpdate(frame),
		},
		{
			name: "performance.end",
			run: (frame) => devTools.profile("performance.end", () => performanceMonitor.endFrame(frame)),
		},
		{
			name: "devtools.end",
			run: () => devTools.endFrame(),
		},
		{
			name: "devtools.render",
			run: (frame) => devTools.renderFrame(frame.now),
		},
	],
	profile: (label, callback) => devTools.profile(label, callback),
	shouldRunContinuously: () => settings.runtime.continuous,
});

app.start();
devTools.sync();
onRouteAfterSwap(() => {
	reconcileSettings(window.location.search, true);
	app.refreshPage("route:after-swap");
	queueMicrotask(() => devTools.sync());
});
