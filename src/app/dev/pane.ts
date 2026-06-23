import { resetSettings, settings, type ThemeColors } from "@/app/core/settings";
import { applyScrollSettings } from "@/app/systems/scroll";
import { applyThemeSettings, onThemeChange } from "@/app/systems/theme";
import { setDataset } from "@/app/utils/dom";
import { Pane, type FolderApi } from "tweakpane";
import { applyDevPaneTheme } from "@/app/dev/theme";

const STYLE_ID = "template-dev-pane-style";
const COPY_SETTINGS_TITLE = "Copy settings";
const COPY_SETTINGS_SUCCESS_TITLE = "Copied JSON";
const COPY_SETTINGS_ERROR_TITLE = "Copy failed";
const COPY_TITLE_RESET_MS = 1600;

export const createDevPane = (): (() => void) => {
	ensureDevPaneStyle();
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
	const disposeActionControls = addActionControls(pane, container);

	const handleChange = (): void => applyAllSettings(container);
	pane.on("change", handleChange);
	const disposeThemeChange = onThemeChange(() => applyDevPaneTheme(container));

	return () => {
		disposeThemeChange();
		disposeActionControls();
		pane.dispose();
		container.remove();
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
		min: 1,
		max: 40,
		step: 0.1,
	});
	folder.addBinding(settings.interaction, "pressLambda", {
		label: "Press lambda",
		min: 1,
		max: 60,
		step: 0.1,
	});
	folder.addBinding(settings.interaction, "pressScale", {
		label: "Press scale",
		min: 0.9,
		max: 1,
		step: 0.001,
	});
	folder.addBinding(settings.interaction, "settleEpsilon", {
		label: "Settle epsilon",
		min: 0.0001,
		max: 0.02,
		step: 0.0001,
	});
};

const addScrollControls = (pane: Pane): void => {
	const folder = pane.addFolder({ title: "Scroll", expanded: true });
	folder.addBinding(settings.scroll, "smoothEnabled", { label: "Smooth" });
	folder.addBinding(settings.scroll, "lambda", {
		label: "Lambda",
		min: 1,
		max: 40,
		step: 0.1,
	});
	folder.addBinding(settings.scroll, "settlePx", {
		label: "Settle px",
		min: 0.01,
		max: 4,
		step: 0.01,
	});
	folder.addBinding(settings.scroll, "wheelMultiplier", {
		label: "Wheel",
		min: 0.25,
		max: 2.5,
		step: 0.01,
	});
	folder.addBinding(settings.scroll, "pageMultiplier", {
		label: "Page",
		min: 0.25,
		max: 1.5,
		step: 0.01,
	});
};

const addMotionControls = (pane: Pane): void => {
	const folder = pane.addFolder({ title: "Motion", expanded: false });
	folder.addBinding(settings.motion, "routeExitMs", {
		label: "Route exit",
		min: 0,
		max: 1200,
		step: 10,
	});
	folder.addBinding(settings.motion, "routeEnterMs", {
		label: "Route enter",
		min: 0,
		max: 1200,
		step: 10,
	});
	folder.addBinding(settings.motion, "routeBufferMs", {
		label: "Route buffer",
		min: 0,
		max: 300,
		step: 10,
	});
};

const addDebugControls = (pane: Pane): void => {
	const folder = pane.addFolder({ title: "Debug", expanded: false });
	folder.addBinding(settings.debug, "enabled", { label: "Enabled" });
	folder.addBinding(settings.debug, "showFrameStats", { label: "Frame stats" });
	folder.addBinding(settings.debug, "showScrollState", { label: "Scroll state" });
};

const addActionControls = (pane: Pane, container: HTMLElement): (() => void) => {
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
		resetSettings();
		applyAllSettings(container);
		pane.refresh();
	});

	return () => {
		if (copyTitleReset !== undefined) window.clearTimeout(copyTitleReset);
	};
};

const copySettingsToClipboard = async (): Promise<void> => {
	const payload = `${JSON.stringify(settings, null, 2)}\n`;

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
	container.dataset["devPane"] = "true";
	container.dataset["nativeScroll"] = "true";
	container.setAttribute("aria-label", "Runtime controls");
	return container;
};

const ensureDevPaneStyle = (): void => {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement("style");
	style.id = STYLE_ID;
	style.textContent = `
		[data-dev-pane='true'] {
			position: fixed;
			inset-block-start: max(0.75rem, env(safe-area-inset-top));
			inset-inline-end: max(0.75rem, env(safe-area-inset-right));
			z-index: 2147483000;
			inline-size: min(20rem, calc(100vw - 1.5rem));
			max-block-size: calc(100dvh - 1.5rem);
			overflow: auto;
			overscroll-behavior: contain;
			scrollbar-width: none;
			user-select: none;
			-ms-overflow-style: none;
			-webkit-user-select: none;
		}

		[data-dev-pane='true']::-webkit-scrollbar {
			display: none;
		}

		[data-dev-pane='true'] .tp-rotv {
			backdrop-filter: blur(18px);
			-webkit-backdrop-filter: blur(18px);
		}
	`;
	document.head.append(style);
};
