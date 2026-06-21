import { App } from "@/app/core/app";
import { applyQuerySettings } from "@/app/core/settings";
import { device, getDeviceProfile } from "@/app/systems/device";
import { input, getInputState } from "@/app/systems/input";
import { motion } from "@/app/systems/motion";
import { performanceMonitor } from "@/app/systems/performance";
import { getRouteState, route } from "@/app/systems/route";
import { getScrollState, scroll } from "@/app/systems/scroll";
import { theme } from "@/app/systems/theme";
import { ui } from "@/app/ui/ui";

applyQuerySettings();

const app = new App(
	{
		device,
		theme,
		route,
		input,
		scroll,
		motion,
		performance: performanceMonitor,
		ui,
	},
	{
		getInput: getInputState,
		getProfile: getDeviceProfile,
		getRoute: getRouteState,
		getScroll: getScrollState,
	},
);

app.start();

if (import.meta.env.DEV) {
	void import("@/app/dev/dev").then(({ initDevTools }) => {
		initDevTools(app);
	});
}
