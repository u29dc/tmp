import { BaseModule, type Context, type Frame } from "@/app/core/module";
import { settings, type ThemeColors } from "@/app/core/settings";
import { setDataset, setStyleProperty } from "@/app/utils/dom";

export type ThemeScheme = "light" | "dark";

class Theme extends BaseModule {
	readonly name = "theme";

	private query: MediaQueryList | undefined;
	private appliedKey = "";

	override preInit(context: Context): void {
		super.preInit(context);
		this.query = window.matchMedia("(prefers-color-scheme: dark)");
		this.query.addEventListener("change", this.handleSystemChange);
		this.addCleanup(() => this.query?.removeEventListener("change", this.handleSystemChange));
		this.applySettings();
	}

	override init(context: Context): void {
		super.init(context);
	}

	override resize(context: Context): void {
		super.resize(context);
	}

	override update(frame: Frame): void {
		super.update(frame);
	}

	override dispose(): void {
		super.dispose();
	}

	applySettings(): void {
		const scheme = this.readScheme();
		const colors = scheme === "dark" ? settings.theme.dark : settings.theme.light;
		const key = JSON.stringify({ mode: settings.theme.mode, scheme, colors });
		if (key === this.appliedKey) return;
		this.appliedKey = key;
		const root = document.documentElement;
		setDataset(root, "theme", scheme);
		setDataset(root, "themeMode", settings.theme.mode);
		root.style.colorScheme = scheme;
		writeThemeColors(root, colors);
		writeThemeMeta(scheme, colors);
	}

	getScheme(): ThemeScheme {
		return this.readScheme();
	}

	getColors(): ThemeColors {
		return this.getScheme() === "dark" ? settings.theme.dark : settings.theme.light;
	}

	private readScheme(): ThemeScheme {
		if (settings.theme.mode === "light" || settings.theme.mode === "dark")
			return settings.theme.mode;
		return this.query?.matches ? "dark" : "light";
	}

	private readonly handleSystemChange = (): void => {
		this.applySettings();
	};
}

const writeThemeColors = (root: HTMLElement, colors: ThemeColors): void => {
	setStyleProperty(root, "--site-ground", colors.ground);
	setStyleProperty(root, "--site-panel", colors.panel);
	setStyleProperty(root, "--site-surface", colors.surface);
	setStyleProperty(root, "--site-ink", colors.ink);
	setStyleProperty(root, "--site-muted", colors.muted);
	setStyleProperty(root, "--site-edge", colors.edge);
	setStyleProperty(root, "--site-edge-soft", colors.edgeSoft);
	setStyleProperty(root, "--site-accent", colors.accent);
	setStyleProperty(root, "--site-focus", colors.focus);
	setStyleProperty(root, "--site-selection-bg", colors.ink);
	setStyleProperty(root, "--site-selection-fg", colors.ground);
};

const writeThemeMeta = (scheme: ThemeScheme, colors: ThemeColors): void => {
	const colorSchemeMeta = document.querySelector<HTMLMetaElement>("meta[name='color-scheme']");
	if (colorSchemeMeta && colorSchemeMeta.content !== scheme) {
		colorSchemeMeta.content = scheme;
	}

	let themeColorMeta = document.querySelector<HTMLMetaElement>(
		"meta[name='theme-color'][data-runtime-theme-color]",
	);
	if (!themeColorMeta) {
		themeColorMeta = document.createElement("meta");
		themeColorMeta.name = "theme-color";
		themeColorMeta.dataset["runtimeThemeColor"] = "true";
		document.head.append(themeColorMeta);
	}
	if (themeColorMeta.content !== colors.ground) themeColorMeta.content = colors.ground;
};

export const theme = new Theme();
export const applyThemeSettings = (): void => theme.applySettings();
export const getThemeScheme = (): ThemeScheme => theme.getScheme();
export const getThemeColors = (): ThemeColors => theme.getColors();
