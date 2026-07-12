import { createCfg, type Cfg, type Control, type Pane } from "cfg";

import { clearSettingsDraft, scheduleSettingsDraftSave } from "@/app/core/draft";
import { createSettingsPatch, getNumberSettingBounds, resetSettings, settings, type SettingPath, type ThemeColors } from "@/app/core/settings";
import { getPerformanceState } from "@/app/systems/performance";
import { applyScrollSettings } from "@/app/systems/scroll";
import { applyThemeSettings, onThemeChange } from "@/app/systems/theme";
import { setDataset } from "@/app/utils/dom";

const COPY_SETTINGS_TITLE = "Copy settings";
const COPY_SETTINGS_SUCCESS_TITLE = "Copied JSON";
const COPY_SETTINGS_ERROR_TITLE = "Copy failed";
const COPY_TITLE_RESET_MS = 1600;
const COMPACT_CONTROLS_QUERY = "(max-width: 760px), (max-height: 700px)";
const FRAME_BUDGET_MS = 16.67;
const FRAME_GRAPH_MAX_MS = 40;
const FPS_GRAPH_MAX = 144;

type DevProfiler = {
	measure: <T>(label: string, callback: () => T) => T;
};

const noopProfiler: DevProfiler = {
	measure: (_label, callback) => callback(),
};

export type DevPane = {
	readonly element: HTMLElement;
	beginFrame: (time: number) => void;
	endFrame: () => void;
	profile: <T>(label: string, callback: () => T) => T;
	renderFrame: (time: number) => void;
	syncSettings: () => void;
	dispose: () => void;
};

export const createDevPane = (): DevPane => {
	const container = createContainer();
	document.body.append(container);
	const compactQuery = window.matchMedia(COMPACT_CONTROLS_QUERY);
	let wasCompact = compactQuery.matches;
	setDataset(container, "controlsCompact", String(wasCompact));

	const cfg = createCfg({
		root: container,
		scheduler: "external",
		theme: settings.theme.mode,
	});
	const settingsPane = cfg.pane({ id: "settings", title: "Settings", collapsed: wasCompact });
	const stats = cfg.pane({ id: "stats", title: "Stats", collapsed: wasCompact });
	const profiler = addTelemetryControls(stats);
	const syncCompactPanes = (matches: boolean): void => {
		setDataset(container, "controlsCompact", String(matches));
		if (matches && !wasCompact) {
			settingsPane.collapse();
			stats.collapse();
		}
		wasCompact = matches;
	};
	const handleCompactChange = (event: MediaQueryListEvent): void => syncCompactPanes(event.matches);

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

	const handleChange = (path?: SettingPath): void => {
		applyAllSettings();
		cfg.setTheme(settings.theme.mode);
		if (!suppressDraftSave && path) scheduleSettingsDraftSave(path);
	};

	const bind = <T>(control: Control<T>, path?: SettingPath): Control<T> => {
		boundControls.add(control);
		control.on("change", () => handleChange(path));
		return control;
	};
	const refreshBoundControls = (): void => {
		for (const control of boundControls) control.refresh();
	};

	addThemeControls(settingsPane, bind);
	addScrollControls(settingsPane, bind);
	addRouterControls(settingsPane, bind);
	addActionControls(settingsPane, cfg, bind, suppressDraftSaveUntilNextTask, refreshBoundControls, (timer) => {
		clearCopyTitleReset();
		copyTitleReset = timer;
	});

	const disposeThemeChange = onThemeChange(() => cfg.setTheme(settings.theme.mode));
	compactQuery.addEventListener("change", handleCompactChange);
	syncCompactPanes(compactQuery.matches);

	let disposed = false;
	return {
		element: container,
		beginFrame: (time) => cfg.beginFrame(time),
		endFrame: () => cfg.endFrame(),
		profile: (label, callback) => profiler.measure(label, callback),
		renderFrame: (time) => cfg.renderFrame(time),
		syncSettings: () => {
			applyAllSettings();
			cfg.setTheme(settings.theme.mode);
			refreshBoundControls();
		},
		dispose: () => {
			if (disposed) return;
			disposed = true;
			compactQuery.removeEventListener("change", handleCompactChange);
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

const addColorControls = (folder: Pane, colors: ThemeColors, path: "theme.light" | "theme.dark", bind: Binder): void => {
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

const addScrollControls = (pane: Pane, bind: Binder): void => {
	const folder = pane.folder("Scroll");
	bind(folder.toggle(settings.scroll, "smoothEnabled", { label: "Smooth" }), "scroll.smoothEnabled");
	bind(
		folder.numberSlider(settings.scroll, "lambda", {
			label: "Lambda",
			...getNumberSettingBounds("scroll.lambda"),
		}),
		"scroll.lambda",
	);
	bind(
		folder.numberSlider(settings.scroll, "wheelMultiplier", {
			label: "Wheel",
			...getNumberSettingBounds("scroll.wheelMultiplier"),
		}),
		"scroll.wheelMultiplier",
	);
};

const addRouterControls = (pane: Pane, bind: Binder): void => {
	const folder = pane.folder("Router");
	bind(
		folder.numberSlider(settings.motion, "routeExitMs", {
			label: "Route exit",
			...getNumberSettingBounds("motion.routeExitMs"),
		}),
		"motion.routeExitMs",
	);
	bind(
		folder.numberSlider(settings.motion, "routeEnterMs", {
			label: "Route enter",
			...getNumberSettingBounds("motion.routeEnterMs"),
		}),
		"motion.routeEnterMs",
	);
	bind(
		folder.numberSlider(settings.motion, "routeBufferMs", {
			label: "Route buffer",
			...getNumberSettingBounds("motion.routeBufferMs"),
		}),
		"motion.routeBufferMs",
	);
};

const addTelemetryControls = (pane: Pane): DevProfiler => {
	pane.fpsGraph({ id: "fps", label: "FPS", min: 0, max: FPS_GRAPH_MAX, target: 60 });
	pane.frameGraph({
		id: "frame",
		label: "Frame",
		min: 0,
		max: FRAME_GRAPH_MAX_MS,
		target: FRAME_BUDGET_MS,
		unit: "ms",
	});
	pane.monitor({
		id: "average-frame",
		label: "Avg ms",
		get: () => getPerformanceState().averageFrameMs,
		format: (value) => value.toFixed(2),
	});
	return noopProfiler;
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
};

const createContainer = (): HTMLElement => {
	const container = document.createElement("aside");
	setDataset(container, "controlsPane", "true");
	setDataset(container, "nativeScroll", "true");
	container.setAttribute("aria-label", "Settings controls");
	return container;
};

type Binder = <T>(control: Control<T>, path?: SettingPath) => Control<T>;
