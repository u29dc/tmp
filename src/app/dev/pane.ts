import { clearSettingsDraft, scheduleSettingsDraftSave } from "@/app/core/draft";
import {
	createSettingsPatch,
	resetSettings,
	SETTING_BOUNDS,
	settings,
	type ThemeColors,
} from "@/app/core/settings";
import { applyScrollSettings } from "@/app/systems/scroll";
import { applyThemeSettings, onThemeChange } from "@/app/systems/theme";
import { setDataset } from "@/app/utils/dom";
import { Pane, type FolderApi } from "tweakpane";
import { applyDevPaneTheme } from "@/app/dev/theme";

const COPY_SETTINGS_TITLE = "Copy settings";
const COPY_SETTINGS_SUCCESS_TITLE = "Copied JSON";
const COPY_SETTINGS_ERROR_TITLE = "Copy failed";
const COPY_TITLE_RESET_MS = 1600;

export type DevPane = {
	readonly element: HTMLElement;
	dispose: () => void;
};

export const createDevPane = (): DevPane => {
	const container = createContainer();
	document.body.append(container);
	applyAllSettings(container);

	const pane = new Pane({
		container,
		expanded: true,
		title: "Runtime",
	});

	addThemeControls(pane);
	addInteractionControls(pane);
	addScrollControls(pane);
	addMotionControls(pane);
	addDebugControls(pane);

	let suppressDraftSave = false;
	const suppressDraftSaveUntilNextTask = (): void => {
		suppressDraftSave = true;
		window.setTimeout(() => {
			suppressDraftSave = false;
		}, 0);
	};

	const disposeActionControls = addActionControls(
		pane,
		container,
		suppressDraftSaveUntilNextTask,
	);

	const handleChange = (): void => {
		applyAllSettings(container);
		if (!suppressDraftSave) scheduleSettingsDraftSave();
	};
	pane.on("change", handleChange);
	const disposeThemeChange = onThemeChange(() => applyDevPaneTheme(container));

	let disposed = false;
	return {
		element: container,
		dispose: () => {
			if (disposed) return;
			disposed = true;
			disposeThemeChange();
			disposeActionControls();
			pane.dispose();
			container.remove();
		},
	};
};

const addThemeControls = (pane: Pane): void => {
	const folder = pane.addFolder({ title: "Theme", expanded: true });
	folder.addBinding(settings.theme, "mode", {
		label: "Mode",
		options: [
			{ text: "System", value: "system" },
			{ text: "Light", value: "light" },
			{ text: "Dark", value: "dark" },
		],
	});
	addColorControls(folder.addFolder({ title: "Light", expanded: false }), settings.theme.light);
	addColorControls(folder.addFolder({ title: "Dark", expanded: false }), settings.theme.dark);
};

const addColorControls = (folder: FolderApi, colors: ThemeColors): void => {
	folder.addBinding(colors, "ground", { label: "Ground" });
	folder.addBinding(colors, "panel", { label: "Panel" });
	folder.addBinding(colors, "surface", { label: "Surface" });
	folder.addBinding(colors, "ink", { label: "Ink" });
	folder.addBinding(colors, "muted", { label: "Muted" });
	folder.addBinding(colors, "edge", { label: "Edge" });
	folder.addBinding(colors, "edgeSoft", { label: "Edge soft" });
	folder.addBinding(colors, "accent", { label: "Accent" });
	folder.addBinding(colors, "focus", { label: "Focus" });
};

const addInteractionControls = (pane: Pane): void => {
	const folder = pane.addFolder({ title: "Interaction", expanded: true });
	folder.addBinding(settings.interaction, "ratioLambda", {
		label: "Hover lambda",
		...SETTING_BOUNDS.interaction.ratioLambda,
	});
	folder.addBinding(settings.interaction, "pressLambda", {
		label: "Press lambda",
		...SETTING_BOUNDS.interaction.pressLambda,
	});
	folder.addBinding(settings.interaction, "pressScale", {
		label: "Press scale",
		...SETTING_BOUNDS.interaction.pressScale,
	});
	folder.addBinding(settings.interaction, "settleEpsilon", {
		label: "Settle epsilon",
		...SETTING_BOUNDS.interaction.settleEpsilon,
	});
};

const addScrollControls = (pane: Pane): void => {
	const folder = pane.addFolder({ title: "Scroll", expanded: true });
	folder.addBinding(settings.scroll, "smoothEnabled", { label: "Smooth" });
	folder.addBinding(settings.scroll, "lambda", {
		label: "Lambda",
		...SETTING_BOUNDS.scroll.lambda,
	});
	folder.addBinding(settings.scroll, "settlePx", {
		label: "Settle px",
		...SETTING_BOUNDS.scroll.settlePx,
	});
	folder.addBinding(settings.scroll, "wheelMultiplier", {
		label: "Wheel",
		...SETTING_BOUNDS.scroll.wheelMultiplier,
	});
	folder.addBinding(settings.scroll, "pageMultiplier", {
		label: "Page",
		...SETTING_BOUNDS.scroll.pageMultiplier,
	});
};

const addMotionControls = (pane: Pane): void => {
	const folder = pane.addFolder({ title: "Motion", expanded: false });
	folder.addBinding(settings.motion, "routeExitMs", {
		label: "Route exit",
		...SETTING_BOUNDS.motion.routeExitMs,
	});
	folder.addBinding(settings.motion, "routeEnterMs", {
		label: "Route enter",
		...SETTING_BOUNDS.motion.routeEnterMs,
	});
	folder.addBinding(settings.motion, "routeBufferMs", {
		label: "Route buffer",
		...SETTING_BOUNDS.motion.routeBufferMs,
	});
};

const addDebugControls = (pane: Pane): void => {
	const folder = pane.addFolder({ title: "Debug", expanded: false });
	folder.addBinding(settings.debug, "enabled", { label: "Enabled" });
	folder.addBinding(settings.debug, "showFrameStats", { label: "Frame stats" });
	folder.addBinding(settings.debug, "showScrollState", { label: "Scroll state" });
};

const addActionControls = (
	pane: Pane,
	container: HTMLElement,
	suppressDraftSaveUntilNextTask: () => void,
): (() => void) => {
	const folder = pane.addFolder({ title: "Actions", expanded: false });
	const copyButton = folder.addButton({ title: COPY_SETTINGS_TITLE });
	let copyTitleReset: number | undefined;

	const setCopyButtonTitle = (title: string): void => {
		copyButton.title = title;
		if (copyTitleReset !== undefined) window.clearTimeout(copyTitleReset);
		if (title === COPY_SETTINGS_TITLE) return;
		copyTitleReset = window.setTimeout(() => {
			copyButton.title = COPY_SETTINGS_TITLE;
			copyTitleReset = undefined;
		}, COPY_TITLE_RESET_MS);
	};

	copyButton.on("click", () => {
		void copySettingsToClipboard()
			.then(() => setCopyButtonTitle(COPY_SETTINGS_SUCCESS_TITLE))
			.catch(() => setCopyButtonTitle(COPY_SETTINGS_ERROR_TITLE));
	});

	folder.addButton({ title: "Reset settings" }).on("click", () => {
		suppressDraftSaveUntilNextTask();
		clearSettingsDraft();
		resetSettings();
		applyAllSettings(container);
		pane.refresh();
	});

	return () => {
		if (copyTitleReset !== undefined) window.clearTimeout(copyTitleReset);
	};
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

	if (!navigator.clipboard || !window.isSecureContext)
		throw new Error("Clipboard API unavailable.");
	await navigator.clipboard.writeText(payload);
};

const applyAllSettings = (container: HTMLElement): void => {
	applyThemeSettings();
	applyScrollSettings();
	applyDebugSettings();
	applyDevPaneTheme(container);
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
