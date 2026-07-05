import { createCfg, type Cfg, type Control, type Pane, type Profiler } from "cfg";

import { clearSettingsDraft, scheduleSettingsDraftSave } from "@/app/core/draft";
import { createSettingsPatch, resetSettings, SETTING_BOUNDS, settings, type ThemeColors } from "@/app/core/settings";
import { getPerformanceState } from "@/app/systems/performance";
import { applyScrollSettings } from "@/app/systems/scroll";
import { applyThemeSettings, onThemeChange } from "@/app/systems/theme";
import { setDataset } from "@/app/utils/dom";

import "cfg/styles.css";

const COPY_SETTINGS_TITLE = "Copy settings";
const COPY_SETTINGS_SUCCESS_TITLE = "Copied JSON";
const COPY_SETTINGS_ERROR_TITLE = "Copy failed";
const COPY_TITLE_RESET_MS = 1600;
const FRAME_BUDGET_MS = 16.67;
const FRAME_GRAPH_MAX_MS = 40;
const FPS_GRAPH_MAX = 144;

export type DevPane = {
	readonly element: HTMLElement;
	beginFrame: (time: number) => void;
	endFrame: () => void;
	profile: <T>(label: string, callback: () => T) => T;
	renderFrame: (time: number) => void;
	dispose: () => void;
};

export const createDevPane = (): DevPane => {
	const container = createContainer();
	document.body.append(container);
	applyAllSettings();

	const cfg = createCfg({
		root: container,
		scheduler: "external",
		theme: settings.theme.mode,
	});
	const runtime = cfg.pane({ id: "runtime", title: "Runtime" });
	const telemetry = cfg.pane({ id: "telemetry", title: "Telemetry" });
	const profiler = addTelemetryControls(telemetry);

	let suppressDraftSave = false;
	let copyTitleReset: number | undefined;
	const boundControls = new Set<Control>();
	const clearCopyTitleReset = (): void => {
		if (copyTitleReset === undefined) return;
		window.clearTimeout(copyTitleReset);
		copyTitleReset = undefined;
	};
	const suppressDraftSaveUntilNextTask = (): void => {
		suppressDraftSave = true;
		window.setTimeout(() => {
			suppressDraftSave = false;
		}, 0);
	};

	const handleChange = (path?: string): void => {
		applyAllSettings();
		cfg.setTheme(settings.theme.mode);
		if (!suppressDraftSave && path) scheduleSettingsDraftSave(path);
	};

	const bind = <T>(control: Control<T>, path?: string): Control<T> => {
		boundControls.add(control);
		control.on("change", () => handleChange(path));
		return control;
	};
	const refreshBoundControls = (): void => {
		for (const control of boundControls) control.refresh();
	};

	addThemeControls(runtime, bind);
	addInteractionControls(runtime, bind);
	addScrollControls(runtime, bind);
	addMotionControls(runtime, bind);
	addDebugControls(runtime, bind);
	addActionControls(runtime, cfg, bind, suppressDraftSaveUntilNextTask, refreshBoundControls, (timer) => {
		clearCopyTitleReset();
		copyTitleReset = timer;
	});

	const disposeThemeChange = onThemeChange(() => cfg.setTheme(settings.theme.mode));

	let disposed = false;
	return {
		element: container,
		beginFrame: (time) => cfg.beginFrame(time),
		endFrame: () => cfg.endFrame(),
		profile: (label, callback) => profiler.measure(label, callback),
		renderFrame: (time) => cfg.renderFrame(time),
		dispose: () => {
			if (disposed) return;
			disposed = true;
			disposeThemeChange();
			clearCopyTitleReset();
			cfg.dispose();
			container.remove();
		},
	};
};

const addThemeControls = (pane: Pane, bind: Binder): void => {
	const folder = pane.folder("Theme");
	bind(
		folder.segmented(settings.theme, "mode", {
			id: "mode",
			label: "Mode",
			options: [
				{ label: "System", value: "system" },
				{ label: "Light", value: "light" },
				{ label: "Dark", value: "dark" },
			],
		}),
		"theme.mode",
	);
	addColorControls(folder.folder("Light", { collapsed: true }), settings.theme.light, "theme.light", bind);
	addColorControls(folder.folder("Dark", { collapsed: true }), settings.theme.dark, "theme.dark", bind);
};

const addColorControls = (folder: Pane, colors: ThemeColors, path: string, bind: Binder): void => {
	bind(folder.color(colors, "ground", { label: "Ground" }), `${path}.ground`);
	bind(folder.color(colors, "panel", { label: "Panel" }), `${path}.panel`);
	bind(folder.color(colors, "surface", { label: "Surface" }), `${path}.surface`);
	bind(folder.color(colors, "ink", { label: "Ink" }), `${path}.ink`);
	bind(folder.color(colors, "muted", { label: "Muted" }), `${path}.muted`);
	bind(folder.color(colors, "edge", { label: "Edge" }), `${path}.edge`);
	bind(folder.color(colors, "edgeSoft", { label: "Edge soft" }), `${path}.edgeSoft`);
	bind(folder.color(colors, "accent", { label: "Accent" }), `${path}.accent`);
	bind(folder.color(colors, "focus", { label: "Focus" }), `${path}.focus`);
};

const addInteractionControls = (pane: Pane, bind: Binder): void => {
	const folder = pane.folder("Interaction");
	bind(
		folder.numberSlider(settings.interaction, "ratioLambda", {
			label: "Hover lambda",
			...SETTING_BOUNDS.interaction.ratioLambda,
		}),
		"interaction.ratioLambda",
	);
	bind(
		folder.numberSlider(settings.interaction, "pressLambda", {
			label: "Press lambda",
			...SETTING_BOUNDS.interaction.pressLambda,
		}),
		"interaction.pressLambda",
	);
	bind(
		folder.numberSlider(settings.interaction, "pressScale", {
			label: "Press scale",
			...SETTING_BOUNDS.interaction.pressScale,
		}),
		"interaction.pressScale",
	);
	bind(
		folder.numberSlider(settings.interaction, "settleEpsilon", {
			label: "Settle epsilon",
			...SETTING_BOUNDS.interaction.settleEpsilon,
		}),
		"interaction.settleEpsilon",
	);
};

const addScrollControls = (pane: Pane, bind: Binder): void => {
	const folder = pane.folder("Scroll");
	bind(folder.toggle(settings.scroll, "smoothEnabled", { label: "Smooth" }), "scroll.smoothEnabled");
	bind(
		folder.numberSlider(settings.scroll, "lambda", {
			label: "Lambda",
			...SETTING_BOUNDS.scroll.lambda,
		}),
		"scroll.lambda",
	);
	bind(
		folder.numberSlider(settings.scroll, "settlePx", {
			label: "Settle px",
			...SETTING_BOUNDS.scroll.settlePx,
		}),
		"scroll.settlePx",
	);
	bind(
		folder.numberSlider(settings.scroll, "wheelMultiplier", {
			label: "Wheel",
			...SETTING_BOUNDS.scroll.wheelMultiplier,
		}),
		"scroll.wheelMultiplier",
	);
	bind(
		folder.numberSlider(settings.scroll, "pageMultiplier", {
			label: "Page",
			...SETTING_BOUNDS.scroll.pageMultiplier,
		}),
		"scroll.pageMultiplier",
	);
};

const addMotionControls = (pane: Pane, bind: Binder): void => {
	const folder = pane.folder("Motion", { collapsed: true });
	bind(
		folder.numberSlider(settings.motion, "routeExitMs", {
			label: "Route exit",
			...SETTING_BOUNDS.motion.routeExitMs,
		}),
		"motion.routeExitMs",
	);
	bind(
		folder.numberSlider(settings.motion, "routeEnterMs", {
			label: "Route enter",
			...SETTING_BOUNDS.motion.routeEnterMs,
		}),
		"motion.routeEnterMs",
	);
	bind(
		folder.numberSlider(settings.motion, "routeBufferMs", {
			label: "Route buffer",
			...SETTING_BOUNDS.motion.routeBufferMs,
		}),
		"motion.routeBufferMs",
	);
};

const addDebugControls = (pane: Pane, bind: Binder): void => {
	const folder = pane.folder("Debug", { collapsed: true });
	bind(folder.toggle(settings.runtime, "continuous", { label: "Loop" }), "runtime.continuous");
	bind(folder.toggle(settings.debug, "enabled", { label: "Enabled" }), "debug.enabled");
	bind(folder.toggle(settings.debug, "showFrameStats", { label: "Frame stats" }), "debug.showFrameStats");
	bind(folder.toggle(settings.debug, "showScrollState", { label: "Scroll state" }), "debug.showScrollState");
};

const addTelemetryControls = (pane: Pane): Profiler => {
	pane.fpsGraph({ id: "fps", label: "FPS", min: 0, max: FPS_GRAPH_MAX, target: 60 });
	pane.frameGraph({
		id: "frame",
		label: "Frame",
		min: 0,
		max: FRAME_GRAPH_MAX_MS,
		target: FRAME_BUDGET_MS,
		unit: "ms",
	});
	const profiler = pane.profiler({ id: "profiler", label: "Profiler", warning: FRAME_BUDGET_MS });
	pane.monitor({ id: "frames", label: "Frames", get: () => getPerformanceState().frameCount });
	pane.monitor({
		id: "average-frame",
		label: "Avg ms",
		get: () => getPerformanceState().averageFrameMs,
		format: (value) => value.toFixed(2),
	});
	pane.monitor({
		id: "long-frames",
		label: "Long",
		get: () => getPerformanceState().longFrameCount,
	});
	return profiler;
};

const addActionControls = (
	pane: Pane,
	cfg: Cfg,
	bind: Binder,
	suppressDraftSaveUntilNextTask: () => void,
	refreshBoundControls: () => void,
	setResetTimer: (timer: number | undefined) => void,
): void => {
	const folder = pane.folder("Actions", { collapsed: true });
	let status = { value: COPY_SETTINGS_TITLE };
	const statusControl = folder.monitor({
		id: "copy-status",
		label: "Copy",
		get: () => status.value,
	});
	const refreshStatus = (value: string): void => {
		status = { value };
		statusControl.refresh();
		if (value === COPY_SETTINGS_TITLE) return;
		const timer = window.setTimeout(() => {
			status = { value: COPY_SETTINGS_TITLE };
			statusControl.refresh();
			setResetTimer(undefined);
		}, COPY_TITLE_RESET_MS);
		setResetTimer(timer);
	};

	folder.button({
		id: "copy-settings",
		label: COPY_SETTINGS_TITLE,
		action: () =>
			copySettingsToClipboard()
				.then(() => refreshStatus(COPY_SETTINGS_SUCCESS_TITLE))
				.catch(() => refreshStatus(COPY_SETTINGS_ERROR_TITLE)),
	});

	bind(
		folder.button({
			id: "reset-settings",
			label: "Reset settings",
			action: () => {
				suppressDraftSaveUntilNextTask();
				clearSettingsDraft();
				resetSettings();
				applyAllSettings();
				cfg.setTheme(settings.theme.mode);
				refreshBoundControls();
			},
		}),
	);
};

const copySettingsToClipboard = async (): Promise<void> => {
	const payload = `${JSON.stringify(
		{
			settings,
			patch: createSettingsPatch(),
		},
		null,
		2,
	)}\n`;

	if (!navigator.clipboard || !window.isSecureContext) throw new Error("Clipboard API unavailable.");
	await navigator.clipboard.writeText(payload);
};

const applyAllSettings = (): void => {
	applyThemeSettings();
	applyScrollSettings();
	applyDebugSettings();
};

const applyDebugSettings = (): void => {
	const root = document.documentElement;
	setDataset(root, "debug", settings.debug.enabled);
	setDataset(root, "debugFrameStats", settings.debug.enabled && settings.debug.showFrameStats);
	setDataset(root, "debugScrollState", settings.debug.enabled && settings.debug.showScrollState);
};

const createContainer = (): HTMLElement => {
	const container = document.createElement("aside");
	setDataset(container, "controlsPane", "true");
	setDataset(container, "nativeScroll", "true");
	container.setAttribute("aria-label", "Runtime controls");
	return container;
};

type Binder = <T>(control: Control<T>, path?: string) => Control<T>;
