import { SETTINGS_DRAFT_SCHEMA } from "./core/storage";

const TRUE_VALUES = new Set(["1", "true", "on"]);
const FALSE_VALUES = new Set(["0", "false", "off"]);
const THEME_COLOR_KEYS = ["ground", "ink"] as const;
const THEME_COLOR_PATH_PATTERN = /^theme\.(light|dark)\.([a-zA-Z]+)$/;

type ThemeMode = "system" | "light" | "dark";
type ThemeScheme = "light" | "dark";
type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];
type ThemeColors = Record<ThemeColorKey, string>;
type ThemeSettings = { mode: ThemeMode; light: ThemeColors; dark: ThemeColors };
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
	mergeThemePatch(themeSettings, readQuerySettings());
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
	if (!light || !dark) return undefined;
	return {
		mode: readThemeMode(candidate["mode"]) ?? "system",
		light,
		dark,
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

function readQuerySettings(): SettingsPatch | undefined {
	if (typeof URLSearchParams === "undefined") return undefined;
	const query = new URLSearchParams(window.location.search);
	const patch: SettingsPatch = {};
	let hasPatch = false;
	for (const [key, value] of query.entries()) {
		if (!isThemePath(key)) continue;
		patch[key] = value;
		hasPatch = true;
	}
	return hasPatch ? patch : undefined;
}

function mergeThemePatch(target: ThemeSettings, patch: unknown): void {
	if (!isRecord(patch)) return;
	for (const [path, value] of Object.entries(patch)) {
		if (path === "theme.mode") {
			const mode = readThemeMode(value);
			if (mode) target.mode = mode;
			continue;
		}
		const colorPath = readColorPath(path);
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
	updateThemeColorMeta(colors.ground);
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

function readThemeMode(value: unknown): ThemeMode | undefined {
	if (value === "system" || value === "light" || value === "dark") return value;
	return undefined;
}

function readThemeScheme(value: unknown): ThemeScheme | undefined {
	if (value === "light" || value === "dark") return value;
	return undefined;
}

function readThemeColorKey(value: unknown): ThemeColorKey | undefined {
	if (value === "ground" || value === "ink") return value;
	return undefined;
}

function readColor(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const color = value.trim();
	if (!color) return undefined;
	if (typeof CSS !== "undefined" && typeof CSS.supports === "function" && !CSS.supports("color", color)) return undefined;
	return color;
}

function readColorPath(path: string): ColorPath | undefined {
	const match = THEME_COLOR_PATH_PATTERN.exec(path);
	if (!match) return undefined;
	const scheme = readThemeScheme(match[1]);
	const key = readThemeColorKey(match[2]);
	if (!scheme || !key) return undefined;
	return { scheme, key };
}

function isThemePath(path: string): boolean {
	return path === "theme.mode" || readColorPath(path) !== undefined;
}

function readSystemScheme(): ThemeScheme {
	return typeof window.matchMedia === "function" && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function updateColorSchemeMeta(scheme: ThemeScheme): void {
	const meta = document.querySelector<HTMLMetaElement>("meta[name='color-scheme']");
	if (meta) meta.content = scheme;
}

function updateThemeColorMeta(color: string): void {
	let meta = document.querySelector<HTMLMetaElement>("meta[name='theme-color'][data-runtime-theme-color]");
	if (!meta) {
		meta = document.createElement("meta");
		meta.name = "theme-color";
		meta.dataset.runtimeThemeColor = "true";
		document.head.append(meta);
	}
	meta.content = color;
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
