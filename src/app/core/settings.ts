export type SettingsValue = boolean | number | string;

export type NumberSettingBounds = {
	min: number;
	max: number;
	step?: number;
};

type BooleanSettingDescriptor = {
	kind: "boolean";
	default: boolean;
};

type NumberSettingDescriptor = NumberSettingBounds & {
	kind: "number";
	default: number;
};

type EnumSettingDescriptor = {
	kind: "enum";
	default: string;
	values: readonly string[];
};

type ColorSettingDescriptor = {
	kind: "color";
	default: string;
};

type SettingDescriptor = BooleanSettingDescriptor | NumberSettingDescriptor | EnumSettingDescriptor | ColorSettingDescriptor;
type SettingTree = { readonly [key: string]: SettingTree | SettingDescriptor };

const booleanSetting = (defaultValue: boolean): BooleanSettingDescriptor => ({
	kind: "boolean",
	default: defaultValue,
});

const numberSetting = (defaultValue: number, bounds: NumberSettingBounds): NumberSettingDescriptor => ({
	kind: "number",
	default: defaultValue,
	...bounds,
});

const enumSetting = <const Values extends readonly string[]>(values: Values, defaultValue: Values[number]): EnumSettingDescriptor & { default: Values[number]; values: Values } => ({
	kind: "enum",
	default: defaultValue,
	values,
});

const colorSetting = (defaultValue: string): ColorSettingDescriptor => ({
	kind: "color",
	default: defaultValue,
});

export const SETTING_SCHEMA = {
	runtime: {
		continuous: booleanSetting(true),
	},
	theme: {
		mode: enumSetting(["system", "light", "dark"] as const, "system"),
		light: {
			ground: colorSetting("#ffffff"),
			panel: colorSetting("#ffffff"),
			surface: colorSetting("#ffffff"),
			ink: colorSetting("#111111"),
			muted: colorSetting("#737373"),
			edge: colorSetting("#d7d7d7"),
			edgeSoft: colorSetting("#ededed"),
			accent: colorSetting("#111111"),
			focus: colorSetting("#111111"),
		},
		dark: {
			ground: colorSetting("#111111"),
			panel: colorSetting("#151515"),
			surface: colorSetting("#1a1a1a"),
			ink: colorSetting("#f5f5f5"),
			muted: colorSetting("#a3a3a3"),
			edge: colorSetting("#333333"),
			edgeSoft: colorSetting("#242424"),
			accent: colorSetting("#f5f5f5"),
			focus: colorSetting("#f5f5f5"),
		},
	},
	interaction: {
		ratioLambda: numberSetting(12, { min: 1, max: 40, step: 0.1 }),
		pressLambda: numberSetting(24, { min: 1, max: 60, step: 0.1 }),
		settleEpsilon: numberSetting(0.001, { min: 0.0001, max: 0.02, step: 0.0001 }),
		pressScale: numberSetting(0.97, { min: 0.9, max: 1, step: 0.001 }),
	},
	scroll: {
		smoothEnabled: booleanSetting(true),
		lambda: numberSetting(10, { min: 1, max: 40, step: 0.1 }),
		settlePx: numberSetting(0.5, { min: 0.01, max: 4, step: 0.01 }),
		wheelMultiplier: numberSetting(1, { min: 0.25, max: 2.5, step: 0.01 }),
		pageMultiplier: numberSetting(0.9, { min: 0.25, max: 1.5, step: 0.01 }),
	},
	motion: {
		routeExitMs: numberSetting(100, { min: 0, max: 1200, step: 10 }),
		routeEnterMs: numberSetting(260, { min: 0, max: 1200, step: 10 }),
		routeBufferMs: numberSetting(40, { min: 0, max: 300, step: 10 }),
	},
	device: {
		smallWidth: numberSetting(640, { min: 320, max: 2560, step: 1 }),
		largeWidth: numberSetting(1440, { min: 640, max: 3840, step: 1 }),
		maxDprHigh: numberSetting(2, { min: 1, max: 4, step: 0.1 }),
		maxDprMedium: numberSetting(1.5, { min: 1, max: 3, step: 0.1 }),
	},
} as const satisfies SettingTree;

type SettingValueFromDescriptor<Descriptor> = Descriptor extends BooleanSettingDescriptor
	? boolean
	: Descriptor extends NumberSettingDescriptor
		? number
		: Descriptor extends EnumSettingDescriptor
			? Descriptor["values"][number]
			: Descriptor extends ColorSettingDescriptor
				? string
				: Descriptor extends object
					? { -readonly [Key in keyof Descriptor]: SettingValueFromDescriptor<Descriptor[Key]> }
					: never;

type SettingPathFromTree<Tree> = {
	[Key in keyof Tree & string]: Tree[Key] extends SettingDescriptor ? Key : Tree[Key] extends object ? `${Key}.${SettingPathFromTree<Tree[Key]>}` : never;
}[keyof Tree & string];

type NumberSettingPathFromTree<Tree> = {
	[Key in keyof Tree & string]: Tree[Key] extends NumberSettingDescriptor ? Key : Tree[Key] extends object ? `${Key}.${NumberSettingPathFromTree<Tree[Key]>}` : never;
}[keyof Tree & string];

export type AppSettings = SettingValueFromDescriptor<typeof SETTING_SCHEMA>;
export type ThemeMode = AppSettings["theme"]["mode"];
export type ThemeColors = AppSettings["theme"]["light"];
export type SettingPath = SettingPathFromTree<typeof SETTING_SCHEMA>;
export type NumberSettingPath = NumberSettingPathFromTree<typeof SETTING_SCHEMA>;
export type SettingsPatch = Partial<Record<SettingPath, SettingsValue>>;

export const THEME_BOOT_PATHS = {
	mode: "theme.mode",
	light: {
		ground: "theme.light.ground",
		ink: "theme.light.ink",
	},
	dark: {
		ground: "theme.dark.ground",
		ink: "theme.dark.ink",
	},
} as const satisfies {
	mode: SettingPath;
	light: { ground: SettingPath; ink: SettingPath };
	dark: { ground: SettingPath; ink: SettingPath };
};

const NUMBER_PATTERN = /^[+-]?(?:\d+|\d*\.\d+)(?:e[+-]?\d+)?$/i;
const SETTING_DESCRIPTORS = flattenSettingSchema(SETTING_SCHEMA);
const SETTING_PATHS = Object.keys(SETTING_DESCRIPTORS) as SettingPath[];

export const createDefaultSettings = (): AppSettings => materializeSettings(SETTING_SCHEMA) as AppSettings;

export const settings: AppSettings = createDefaultSettings();

export const resetSettings = (): void => {
	mergeRecords(settings, createDefaultSettings());
};

export const getNumberSettingBounds = (path: NumberSettingPath): NumberSettingBounds => {
	const descriptor = SETTING_DESCRIPTORS[path];
	if (descriptor.kind !== "number") throw new TypeError(`Expected a number setting at ${path}.`);
	return descriptor.step === undefined ? { min: descriptor.min, max: descriptor.max } : { min: descriptor.min, max: descriptor.max, step: descriptor.step };
};

export const isSettingPath = (path: string): path is SettingPath => Object.prototype.hasOwnProperty.call(SETTING_DESCRIPTORS, path);

export const applyQuerySettings = (search?: string): void => {
	const query = search ?? (typeof window === "undefined" ? "" : window.location.search);
	if (!query || typeof URLSearchParams === "undefined") return;
	const entries = new URLSearchParams(query);
	applySettingsEntries(Array.from(entries.entries(), ([key, value]): readonly [string, SettingsValue] => [key, value === "" ? true : value]));
};

export const createSettingsPatch = (paths?: Iterable<SettingPath>): SettingsPatch => {
	const patch: SettingsPatch = {};
	const defaults = createDefaultSettings();
	for (const path of paths === undefined ? SETTING_PATHS : new Set(paths)) {
		const currentValue = readSettingsPathValue(settings, path);
		const defaultValue = readSettingsPathValue(defaults, path);
		if (currentValue !== undefined && defaultValue !== undefined && currentValue !== defaultValue) patch[path] = currentValue;
	}
	return patch;
};

export const parseSettingsPatch = (value: unknown): SettingsPatch | undefined => {
	if (!isRecord(value)) return undefined;
	const patch: SettingsPatch = {};
	for (const [path, patchValue] of Object.entries(value)) {
		if (!isSettingPath(path) || !isSettingsValue(patchValue)) return undefined;
		patch[path] = patchValue;
	}
	return patch;
};

export const applySettingsPatch = (patch: unknown): void => {
	const parsed = parseSettingsPatch(patch);
	if (!parsed) return;
	applySettingsEntries(Object.entries(parsed));
};

const applySettingsEntries = (entries: Iterable<readonly [string, unknown]>): void => {
	const candidate = cloneSettings(settings);
	let changed = false;
	for (const [path, value] of entries) {
		if (!isSettingPath(path) || !isSettingsValue(value)) continue;
		changed = setSettingByPath(candidate, path, value) || changed;
	}
	if (!changed || !isSettingsCandidateValid(candidate)) return;
	mergeRecords(settings, candidate);
};

const setSettingByPath = (target: AppSettings, path: SettingPath, value: SettingsValue): boolean => {
	const descriptor = SETTING_DESCRIPTORS[path];
	const next = readSettingValue(descriptor, value);
	if (next === undefined) return false;

	const parts = path.split(".");
	let cursor: unknown = target;
	for (const part of parts.slice(0, -1)) {
		if (!isRecord(cursor) || !(part in cursor)) return false;
		cursor = cursor[part];
	}
	const key = parts.at(-1);
	if (!key || !isRecord(cursor) || !(key in cursor)) return false;
	cursor[key] = next;
	return true;
};

const readSettingValue = (descriptor: SettingDescriptor, value: SettingsValue): SettingsValue | undefined => {
	if (descriptor.kind === "boolean") return readBoolean(value);
	if (descriptor.kind === "number") return readNumber(descriptor, value);
	if (typeof value !== "string") return undefined;
	const candidate = value.trim();
	if (!candidate) return undefined;
	if (descriptor.kind === "enum") return descriptor.values.includes(candidate) ? candidate : undefined;
	return isColorValue(candidate) ? candidate : undefined;
};

const readBoolean = (value: SettingsValue): boolean | undefined => {
	if (typeof value === "boolean") return value;
	if (value === "0" || value === "false" || value === "off") return false;
	if (value === "1" || value === "true" || value === "on") return true;
	return undefined;
};

const readNumber = (descriptor: NumberSettingDescriptor, value: SettingsValue): number | undefined => {
	if (typeof value === "boolean") return undefined;
	const raw = typeof value === "number" ? String(value) : value.trim();
	if (!NUMBER_PATTERN.test(raw)) return undefined;
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed < descriptor.min || parsed > descriptor.max) return undefined;
	return parsed;
};

const isColorValue = (value: string): boolean => {
	if (!value) return false;
	if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return true;
	return CSS.supports("color", value);
};

const isSettingsCandidateValid = (candidate: AppSettings): boolean => candidate.device.smallWidth < candidate.device.largeWidth && candidate.device.maxDprMedium <= candidate.device.maxDprHigh;

const cloneSettings = (source: AppSettings): AppSettings => {
	const clone = createDefaultSettings();
	mergeRecords(clone, source);
	return clone;
};

const readSettingsPathValue = (source: AppSettings, path: SettingPath): SettingsValue | undefined => {
	let cursor: unknown = source;
	for (const part of path.split(".")) {
		if (!isRecord(cursor) || !(part in cursor)) return undefined;
		cursor = cursor[part];
	}
	return isSettingsValue(cursor) ? cursor : undefined;
};

function flattenSettingSchema(tree: SettingTree, prefix = "", descriptors: Record<string, SettingDescriptor> = {}): Record<SettingPath, SettingDescriptor> {
	for (const [key, value] of Object.entries(tree)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (isSettingDescriptor(value)) descriptors[path] = value;
		else flattenSettingSchema(value, path, descriptors);
	}
	return descriptors;
}

function materializeSettings(tree: SettingTree): unknown {
	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(tree)) {
		result[key] = isSettingDescriptor(value) ? value.default : materializeSettings(value);
	}
	return result;
}

function mergeRecords(target: unknown, source: unknown): void {
	if (!isRecord(target) || !isRecord(source)) return;
	for (const key of Object.keys(source)) {
		const next = source[key];
		const current = target[key];
		if (isRecord(current) && isRecord(next)) mergeRecords(current, next);
		else target[key] = next;
	}
}

function isSettingDescriptor(value: SettingTree | SettingDescriptor): value is SettingDescriptor {
	return "kind" in value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSettingsValue(value: unknown): value is SettingsValue {
	return typeof value === "boolean" || typeof value === "number" || typeof value === "string";
}
