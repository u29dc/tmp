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

export const applyQuerySettings = (search = window.location.search): void => {
	if (!search || !window.URLSearchParams) return;
	const entries = new URLSearchParams(search);
	for (const [key, value] of entries.entries()) {
		setSettingByPath(settings, key, value === "" ? true : value);
	}
};

const setSettingByPath = (target: AppSettings, path: string, value: QueryValue): void => {
	const parts = path.split(".");
	let cursor: unknown = target;
	for (const part of parts.slice(0, -1)) {
		if (!isRecord(cursor) || !(part in cursor)) return;
		cursor = cursor[part];
	}
	const key = parts.at(-1);
	if (!key || !isRecord(cursor) || !(key in cursor)) return;
	const previous = cursor[key];
	if (typeof previous === "boolean") cursor[key] = readBoolean(value, previous);
	else if (typeof previous === "number") cursor[key] = readNumber(value, previous);
	else if (typeof previous === "string") cursor[key] = String(value);
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

const readNumber = (value: QueryValue, fallback: number): number => {
	if (value === true) return fallback;
	const parsed = Number.parseFloat(value);
	return Number.isFinite(parsed) ? parsed : fallback;
};
