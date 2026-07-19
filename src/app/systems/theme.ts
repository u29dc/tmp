import { BaseModule, type Context } from "@/app/core/module";
import { settings, type ThemeColors } from "@/app/core/settings";
import { setDataset, setStyleProperty } from "@/app/utils/dom";

export type ThemeScheme = "light" | "dark";
type ThemeHandler = (scheme: ThemeScheme, colors: ThemeColors) => void;

class Theme extends BaseModule {
	readonly name = "theme";

	private query: MediaQueryList | undefined;
	private appliedKey = "";
	private appliedRoot: HTMLElement | undefined;
	private readonly changeHandlers = new Set<ThemeHandler>();

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
		this.applySettings();
	}

	override dispose(): void {
		this.changeHandlers.clear();
		super.dispose();
	}

	applySettings(): void {
		const scheme = this.readScheme();
		const colors = scheme === "dark" ? settings.theme.dark : settings.theme.light;
		const key = JSON.stringify({ mode: settings.theme.mode, scheme, colors });
		const root = document.documentElement;
		if (key === this.appliedKey && root === this.appliedRoot && hasAppliedTheme(root, scheme, colors)) {
			return;
		}
		this.appliedKey = key;
		this.appliedRoot = root;
		setDataset(root, "theme", scheme);
		setDataset(root, "themeMode", settings.theme.mode);
		setStyleProperty(root, "color-scheme", scheme);
		writeThemeColors(root, colors);
		writeThemeMeta(scheme, colors);
		this.emitChange(scheme, colors);
	}

	getScheme(): ThemeScheme {
		return this.readScheme();
	}

	getColors(): ThemeColors {
		return this.getScheme() === "dark" ? settings.theme.dark : settings.theme.light;
	}

	onChange(handler: ThemeHandler): () => void {
		this.changeHandlers.add(handler);
		return () => this.changeHandlers.delete(handler);
	}

	private readScheme(): ThemeScheme {
		if (settings.theme.mode === "light" || settings.theme.mode === "dark") return settings.theme.mode;
		return this.query?.matches ? "dark" : "light";
	}

	private emitChange(scheme: ThemeScheme, colors: ThemeColors): void {
		for (const handler of this.changeHandlers) handler(scheme, colors);
	}

	private readonly handleSystemChange = (): void => {
		this.applySettings();
	};
}

const hasAppliedTheme = (root: HTMLElement, scheme: ThemeScheme, colors: ThemeColors): boolean => {
	const colorSchemeMeta = document.querySelector<HTMLMetaElement>("meta[name='color-scheme']");
	const lightThemeColorMeta = document.querySelector<HTMLMetaElement>("meta[name='theme-color'][data-theme-color='light']");
	const darkThemeColorMeta = document.querySelector<HTMLMetaElement>("meta[name='theme-color'][data-theme-color='dark']");
	const themeMetaColors = readThemeMetaColors(scheme, colors);
	return (
		root.dataset["theme"] === scheme &&
		root.dataset["themeMode"] === settings.theme.mode &&
		root.style.getPropertyValue("color-scheme") === scheme &&
		root.style.getPropertyValue("--site-ground") === colors.ground &&
		root.style.getPropertyValue("--site-ink") === colors.ink &&
		colorSchemeMeta?.content === scheme &&
		lightThemeColorMeta?.content === themeMetaColors.light &&
		darkThemeColorMeta?.content === themeMetaColors.dark
	);
};

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

	const lightThemeColorMeta = document.querySelector<HTMLMetaElement>("meta[name='theme-color'][data-theme-color='light']");
	const darkThemeColorMeta = document.querySelector<HTMLMetaElement>("meta[name='theme-color'][data-theme-color='dark']");
	const themeMetaColors = readThemeMetaColors(scheme, colors);
	if (lightThemeColorMeta && lightThemeColorMeta.content !== themeMetaColors.light) lightThemeColorMeta.content = themeMetaColors.light;
	if (darkThemeColorMeta && darkThemeColorMeta.content !== themeMetaColors.dark) darkThemeColorMeta.content = themeMetaColors.dark;
};

const readThemeMetaColors = (scheme: ThemeScheme, colors: ThemeColors): { light: string; dark: string } => {
	if (settings.theme.mode === "system") {
		return {
			light: settings.theme.light.ground,
			dark: settings.theme.dark.ground,
		};
	}
	const selected = scheme === "dark" ? settings.theme.dark.ground : colors.ground;
	return { light: selected, dark: selected };
};

export const theme = new Theme();
export const applyThemeSettings = (): void => theme.applySettings();
export const getThemeScheme = (): ThemeScheme => theme.getScheme();
export const getThemeColors = (): ThemeColors => theme.getColors();
export const onThemeChange = (handler: ThemeHandler): (() => void) => theme.onChange(handler);
