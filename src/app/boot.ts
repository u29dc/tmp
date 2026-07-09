import { SETTINGS_DRAFT_SCHEMA } from "./core/storage";

const TRUE_VALUES = new Set(["1", "true", "on"]);
const FALSE_VALUES = new Set(["0", "false", "off"]);
const THEME_COLOR_KEYS = ["ground", "ink"] as const;

type ThemeMode = "system" | "light" | "dark";
type ThemeScheme = "light" | "dark";
type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];
type ThemeColors = Record<ThemeColorKey, string>;
type ThemePaths = { mode: string; light: Record<ThemeColorKey, string>; dark: Record<ThemeColorKey, string> };
type ThemeSettings = { mode: ThemeMode; light: ThemeColors; dark: ThemeColors; paths: ThemePaths };
type ColorPath = { scheme: ThemeScheme; key: ThemeColorKey };
type SettingsValue = boolean | number | string;
type SettingsPatch = Record<string, SettingsValue>;

const root = document.documentElement;
const namespace = readNamespace(root.dataset.siteNamespace);
const controlsKey = `${namespace}:controls`;
const settingsKey = `${namespace}:settings`;
const themeSettings = readThemeSettings(root.dataset.themeSettings);

if (themeSettings) {
	const controlsEnabled = readControls(controlsKey, readBoolean(root.dataset.controlsDefault) ?? false);
	if (controlsEnabled) mergeThemePatch(themeSettings, readStoredSettings(settingsKey));
	mergeThemePatch(themeSettings, readQuerySettings(themeSettings.paths));
	applyTheme(themeSettings);
}

function readNamespace(value: unknown): string {
	if (typeof value !== "string") return "site";
	const namespaceValue = value.trim();
	return namespaceValue.length > 0 ? namespaceValue : "site";
}

function readControls(key: string, defaultValue: boolean): boolean {
	const query = readQueryValue("controls");
	const queryState = readBoolean(query);
	if (queryState !== undefined) {
		writeSession(key, queryState ? "1" : "0");
		return queryState;
	}
	const stored = readBoolean(readSession(key));
	return stored ?? defaultValue;
}

function readThemeSettings(raw: unknown): ThemeSettings | undefined {
	const candidate = readJsonRecord(raw);
	if (!candidate) return undefined;
	const light = readThemeColors(candidate["light"]);
	const dark = readThemeColors(candidate["dark"]);
	const paths = readThemePaths(candidate["paths"]);
	if (!light || !dark || !paths) return undefined;
	return {
		mode: readThemeMode(candidate["mode"]) ?? "system",
		light,
		dark,
		paths,
	};
}

function readStoredSettings(key: string): SettingsPatch | undefined {
	const candidate = readJsonRecord(readLocal(key));
	if (!candidate) return undefined;
	if (candidate["schema"] !== SETTINGS_DRAFT_SCHEMA) return undefined;
	const patch = candidate["patch"];
	if (!isSettingsPatch(patch)) return undefined;
	return patch;
}

function readQuerySettings(paths: ThemePaths): SettingsPatch | undefined {
	if (typeof URLSearchParams === "undefined") return undefined;
	const query = new URLSearchParams(window.location.search);
	const patch: SettingsPatch = {};
	let hasPatch = false;
	for (const [key, value] of query.entries()) {
		if (!isThemePath(key, paths)) continue;
		patch[key] = value;
		hasPatch = true;
	}
	return hasPatch ? patch : undefined;
}

function mergeThemePatch(target: ThemeSettings, patch: unknown): void {
	if (!isRecord(patch)) return;
	for (const [path, value] of Object.entries(patch)) {
		if (path === target.paths.mode) {
			const mode = readThemeMode(value);
			if (mode) target.mode = mode;
			continue;
		}
		const colorPath = readColorPath(path, target.paths);
		if (!colorPath) continue;
		const color = readColor(value);
		if (color) target[colorPath.scheme][colorPath.key] = color;
	}
}

function applyTheme(theme: ThemeSettings): void {
	const scheme = theme.mode === "light" || theme.mode === "dark" ? theme.mode : readSystemScheme();
	const colors = scheme === "dark" ? theme.dark : theme.light;
	root.dataset.theme = scheme;
	root.dataset.themeMode = theme.mode;
	root.style.setProperty("color-scheme", scheme);
	root.style.setProperty("--site-ground", colors.ground);
	root.style.setProperty("--site-ink", colors.ink);
	root.style.setProperty("--site-selection-bg", colors.ink);
	root.style.setProperty("--site-selection-fg", colors.ground);
	root.style.setProperty("background-color", "var(--site-ground)");
	root.style.setProperty("color", "var(--site-ink)");
	updateColorSchemeMeta(scheme);
	updateThemeColorMeta(theme, colors.ground);
}

function readThemeColors(value: unknown): ThemeColors | undefined {
	if (!isRecord(value)) return undefined;
	const colors: Partial<ThemeColors> = {};
	for (const key of THEME_COLOR_KEYS) {
		const color = readColor(value[key]);
		if (!color) return undefined;
		colors[key] = color;
	}
	if (!colors.ground || !colors.ink) return undefined;
	return {
		ground: colors.ground,
		ink: colors.ink,
	};
}

function readThemePaths(value: unknown): ThemePaths | undefined {
	if (!isRecord(value)) return undefined;
	const mode = readNonEmptyString(value["mode"]);
	const light = readThemeColorPaths(value["light"]);
	const dark = readThemeColorPaths(value["dark"]);
	return mode && light && dark ? { mode, light, dark } : undefined;
}

function readThemeColorPaths(value: unknown): Record<ThemeColorKey, string> | undefined {
	if (!isRecord(value)) return undefined;
	const ground = readNonEmptyString(value["ground"]);
	const ink = readNonEmptyString(value["ink"]);
	return ground && ink ? { ground, ink } : undefined;
}

function readThemeMode(value: unknown): ThemeMode | undefined {
	if (value === "system" || value === "light" || value === "dark") return value;
	return undefined;
}

function readColor(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const color = value.trim();
	if (!color) return undefined;
	if (typeof CSS !== "undefined" && typeof CSS.supports === "function" && !CSS.supports("color", color)) return undefined;
	return color;
}

function readColorPath(path: string, paths: ThemePaths): ColorPath | undefined {
	for (const scheme of ["light", "dark"] as const) {
		for (const key of THEME_COLOR_KEYS) {
			if (path === paths[scheme][key]) return { scheme, key };
		}
	}
	return undefined;
}

function isThemePath(path: string, paths: ThemePaths): boolean {
	return path === paths.mode || readColorPath(path, paths) !== undefined;
}

function readSystemScheme(): ThemeScheme {
	return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateColorSchemeMeta(scheme: ThemeScheme): void {
	const meta = document.querySelector<HTMLMetaElement>("meta[name='color-scheme']");
	if (meta) meta.content = scheme;
}

function updateThemeColorMeta(theme: ThemeSettings, selectedColor: string): void {
	const forcedColor = theme.mode === "system" ? undefined : selectedColor;
	const light = document.querySelector<HTMLMetaElement>("meta[name='theme-color'][data-theme-color='light']");
	const dark = document.querySelector<HTMLMetaElement>("meta[name='theme-color'][data-theme-color='dark']");
	if (light) light.content = forcedColor ?? theme.light.ground;
	if (dark) dark.content = forcedColor ?? theme.dark.ground;
}

function readNonEmptyString(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const candidate = value.trim();
	return candidate || undefined;
}

function readQueryValue(name: string): string | undefined {
	if (typeof URLSearchParams === "undefined") return undefined;
	const query = new URLSearchParams(window.location.search);
	if (!query.has(name)) return undefined;
	return query.get(name) ?? "";
}

function readBoolean(value: unknown): boolean | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim().toLowerCase();
	if (TRUE_VALUES.has(normalized)) return true;
	if (FALSE_VALUES.has(normalized)) return false;
	return undefined;
}

function readSession(key: string): string | undefined {
	try {
		return window.sessionStorage.getItem(key) ?? undefined;
	} catch {
		return undefined;
	}
}

function writeSession(key: string, value: string): void {
	try {
		window.sessionStorage.setItem(key, value);
	} catch {
		// Storage can be unavailable in hardened browser contexts.
	}
}

function readLocal(key: string): string | undefined {
	try {
		return window.localStorage.getItem(key) ?? undefined;
	} catch {
		return undefined;
	}
}

function readJsonRecord(raw: unknown): Record<string, unknown> | undefined {
	if (typeof raw !== "string" || !raw) return undefined;
	try {
		const candidate = JSON.parse(raw) as unknown;
		return isRecord(candidate) ? candidate : undefined;
	} catch {
		return undefined;
	}
}

function isSettingsPatch(value: unknown): value is SettingsPatch {
	if (!isRecord(value)) return false;
	for (const patchValue of Object.values(value)) {
		if (typeof patchValue !== "boolean" && typeof patchValue !== "number" && typeof patchValue !== "string") return false;
	}
	return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
