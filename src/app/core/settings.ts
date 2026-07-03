export type ThemeMode = "system" | "light" | "dark";

export type ThemeColors = {
	ground: string;
	panel: string;
	surface: string;
	ink: string;
	muted: string;
	edge: string;
	edgeSoft: string;
	accent: string;
	focus: string;
};

export type AppSettings = {
	debug: {
		enabled: boolean;
		showFrameStats: boolean;
		showScrollState: boolean;
	};
	theme: {
		mode: ThemeMode;
		light: ThemeColors;
		dark: ThemeColors;
	};
	interaction: {
		ratioLambda: number;
		pressLambda: number;
		settleEpsilon: number;
		pressScale: number;
	};
	scroll: {
		smoothEnabled: boolean;
		lambda: number;
		settlePx: number;
		wheelMultiplier: number;
		pageMultiplier: number;
	};
	motion: {
		routeExitMs: number;
		routeEnterMs: number;
		routeBufferMs: number;
	};
	device: {
		smallWidth: number;
		largeWidth: number;
		maxDprHigh: number;
		maxDprMedium: number;
	};
};

type QueryValue = string | true;

export type NumberSettingBounds = {
	min: number;
	max: number;
	step?: number;
};

export const SETTING_BOUNDS = {
	interaction: {
		ratioLambda: { min: 1, max: 40, step: 0.1 },
		pressLambda: { min: 1, max: 60, step: 0.1 },
		pressScale: { min: 0.9, max: 1, step: 0.001 },
		settleEpsilon: { min: 0.0001, max: 0.02, step: 0.0001 },
	},
	scroll: {
		lambda: { min: 1, max: 40, step: 0.1 },
		settlePx: { min: 0.01, max: 4, step: 0.01 },
		wheelMultiplier: { min: 0.25, max: 2.5, step: 0.01 },
		pageMultiplier: { min: 0.25, max: 1.5, step: 0.01 },
	},
	motion: {
		routeExitMs: { min: 0, max: 1200, step: 10 },
		routeEnterMs: { min: 0, max: 1200, step: 10 },
		routeBufferMs: { min: 0, max: 300, step: 10 },
	},
	device: {
		smallWidth: { min: 320, max: 2560, step: 1 },
		largeWidth: { min: 640, max: 3840, step: 1 },
		maxDprHigh: { min: 1, max: 4, step: 0.1 },
		maxDprMedium: { min: 1, max: 3, step: 0.1 },
	},
} as const satisfies {
	interaction: Record<keyof AppSettings["interaction"], NumberSettingBounds>;
	scroll: Record<Exclude<keyof AppSettings["scroll"], "smoothEnabled">, NumberSettingBounds>;
	motion: Record<keyof AppSettings["motion"], NumberSettingBounds>;
	device: Record<keyof AppSettings["device"], NumberSettingBounds>;
};

const NUMBER_SETTING_BOUNDS: Record<string, NumberSettingBounds> = {
	"interaction.ratioLambda": SETTING_BOUNDS.interaction.ratioLambda,
	"interaction.pressLambda": SETTING_BOUNDS.interaction.pressLambda,
	"interaction.pressScale": SETTING_BOUNDS.interaction.pressScale,
	"interaction.settleEpsilon": SETTING_BOUNDS.interaction.settleEpsilon,
	"scroll.lambda": SETTING_BOUNDS.scroll.lambda,
	"scroll.settlePx": SETTING_BOUNDS.scroll.settlePx,
	"scroll.wheelMultiplier": SETTING_BOUNDS.scroll.wheelMultiplier,
	"scroll.pageMultiplier": SETTING_BOUNDS.scroll.pageMultiplier,
	"motion.routeExitMs": SETTING_BOUNDS.motion.routeExitMs,
	"motion.routeEnterMs": SETTING_BOUNDS.motion.routeEnterMs,
	"motion.routeBufferMs": SETTING_BOUNDS.motion.routeBufferMs,
	"device.smallWidth": SETTING_BOUNDS.device.smallWidth,
	"device.largeWidth": SETTING_BOUNDS.device.largeWidth,
	"device.maxDprHigh": SETTING_BOUNDS.device.maxDprHigh,
	"device.maxDprMedium": SETTING_BOUNDS.device.maxDprMedium,
};

const THEME_COLOR_KEYS = new Set([
	"theme.light.ground",
	"theme.light.panel",
	"theme.light.surface",
	"theme.light.ink",
	"theme.light.muted",
	"theme.light.edge",
	"theme.light.edgeSoft",
	"theme.light.accent",
	"theme.light.focus",
	"theme.dark.ground",
	"theme.dark.panel",
	"theme.dark.surface",
	"theme.dark.ink",
	"theme.dark.muted",
	"theme.dark.edge",
	"theme.dark.edgeSoft",
	"theme.dark.accent",
	"theme.dark.focus",
]);

const NUMBER_PATTERN = /^[+-]?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?$/i;

export const createDefaultSettings = (): AppSettings => ({
	debug: {
		enabled: false,
		showFrameStats: false,
		showScrollState: false,
	},
	theme: {
		mode: "system",
		light: {
			ground: "#ffffff",
			panel: "#ffffff",
			surface: "#ffffff",
			ink: "#111111",
			muted: "#737373",
			edge: "#d7d7d7",
			edgeSoft: "#ededed",
			accent: "#111111",
			focus: "#111111",
		},
		dark: {
			ground: "#111111",
			panel: "#151515",
			surface: "#1a1a1a",
			ink: "#f5f5f5",
			muted: "#a3a3a3",
			edge: "#333333",
			edgeSoft: "#242424",
			accent: "#f5f5f5",
			focus: "#f5f5f5",
		},
	},
	interaction: {
		ratioLambda: 12,
		pressLambda: 24,
		settleEpsilon: 0.001,
		pressScale: 0.97,
	},
	scroll: {
		smoothEnabled: true,
		lambda: 10,
		settlePx: 0.5,
		wheelMultiplier: 1,
		pageMultiplier: 0.9,
	},
	motion: {
		routeExitMs: 220,
		routeEnterMs: 260,
		routeBufferMs: 40,
	},
	device: {
		smallWidth: 640,
		largeWidth: 1440,
		maxDprHigh: 2,
		maxDprMedium: 1.5,
	},
});

export const settings: AppSettings = createDefaultSettings();

export const resetSettings = (): void => {
	mergeRecords(settings, createDefaultSettings());
};

export const applyQuerySettings = (search?: string): void => {
	const query = search ?? (typeof window === "undefined" ? "" : window.location.search);
	if (!query || typeof URLSearchParams === "undefined") return;
	const entries = new URLSearchParams(query);
	for (const [key, value] of entries.entries()) {
		setSettingByPath(settings, key, value === "" ? true : value);
	}
};

const setSettingByPath = (target: AppSettings, path: string, value: QueryValue): void => {
	const parts = path.split(".");
	if (parts.some((part) => part.length === 0)) return;
	let cursor: unknown = target;
	for (const part of parts.slice(0, -1)) {
		if (!isRecord(cursor) || !(part in cursor)) return;
		cursor = cursor[part];
	}
	const key = parts.at(-1);
	if (!key || !isRecord(cursor) || !(key in cursor)) return;
	const previous = cursor[key];
	if (typeof previous === "boolean") cursor[key] = readBoolean(value, previous);
	else if (typeof previous === "number") cursor[key] = readNumber(path, value, previous, target);
	else if (typeof previous === "string") cursor[key] = readString(path, value, previous);
};

const mergeRecords = (target: unknown, source: unknown): void => {
	if (!isRecord(target) || !isRecord(source)) return;
	for (const key of Object.keys(source)) {
		const next = source[key];
		const current = target[key];
		if (isRecord(current) && isRecord(next)) mergeRecords(current, next);
		else target[key] = next;
	}
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === "object";

const readBoolean = (value: QueryValue, fallback: boolean): boolean => {
	if (value === true) return true;
	if (value === "0" || value === "false" || value === "off") return false;
	if (value === "1" || value === "true" || value === "on") return true;
	return fallback;
};

const readNumber = (
	path: string,
	value: QueryValue,
	fallback: number,
	target: AppSettings,
): number => {
	if (value === true) return fallback;
	const raw = value.trim();
	if (!NUMBER_PATTERN.test(raw)) return fallback;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed)) return fallback;
	const bounds = NUMBER_SETTING_BOUNDS[path];
	if (!bounds || parsed < bounds.min || parsed > bounds.max) return fallback;
	if (!isCrossFieldNumberValid(path, parsed, target)) return fallback;
	return parsed;
};

const readString = (path: string, value: QueryValue, fallback: string): string => {
	if (value === true) return fallback;
	const candidate = value.trim();
	if (!candidate) return fallback;
	if (path === "theme.mode") return isThemeMode(candidate) ? candidate : fallback;
	if (THEME_COLOR_KEYS.has(path)) return isColorValue(candidate) ? candidate : fallback;
	return fallback;
};

const isThemeMode = (value: string): value is ThemeMode =>
	value === "system" || value === "light" || value === "dark";

const isColorValue = (value: string): boolean => {
	if (!value) return false;
	if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return true;
	return CSS.supports("color", value);
};

const isCrossFieldNumberValid = (path: string, value: number, target: AppSettings): boolean => {
	if (path === "device.smallWidth") return value < target.device.largeWidth;
	if (path === "device.largeWidth") return value > target.device.smallWidth;
	if (path === "device.maxDprHigh") return value >= target.device.maxDprMedium;
	if (path === "device.maxDprMedium") return value <= target.device.maxDprHigh;
	return true;
};
