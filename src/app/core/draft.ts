import { storageKey } from "@/app/core/namespace";
import { applySettingsPatch, createSettingsPatch, parseSettingsPatch, type SettingPath, type SettingsPatch } from "@/app/core/settings";
import { SETTINGS_DRAFT_SCHEMA } from "@/app/core/storage";

const SETTINGS_DRAFT_SAVE_DELAY_MS = 120;
const SETTINGS_STORAGE_KEY = storageKey("settings");

type SettingsDraft = {
	schema: typeof SETTINGS_DRAFT_SCHEMA;
	patch: SettingsPatch;
};

let saveTimer: number | undefined;
let pageHideBound = false;
let baseDraftPatch: SettingsPatch = {};
const dirtyDraftPaths = new Set<SettingPath>();

export const loadSettingsDraft = (): void => {
	baseDraftPatch = {};
	dirtyDraftPaths.clear();
	const raw = readDraftStorage();
	if (raw === undefined) return;
	const draft = parseSettingsDraft(raw);
	if (!draft) {
		clearSettingsDraft();
		return;
	}
	baseDraftPatch = cloneSettingsPatch(draft.patch);
	applySettingsPatch(draft.patch);
};

export const saveSettingsDraft = (): void => {
	const nextPatch = cloneSettingsPatch(baseDraftPatch);
	const dirtyPatch = createSettingsPatch(dirtyDraftPaths);
	for (const path of dirtyDraftPaths) {
		const nextValue = dirtyPatch[path];
		if (nextValue !== undefined) nextPatch[path] = nextValue;
		else delete nextPatch[path];
	}
	dirtyDraftPaths.clear();
	baseDraftPatch = cloneSettingsPatch(nextPatch);
	writeSettingsPatch(nextPatch);
};

export const scheduleSettingsDraftSave = (path: SettingPath): void => {
	if (typeof window === "undefined") return;
	if (!path) return;
	dirtyDraftPaths.add(path);
	bindPageHideFlush();
	clearSaveTimer();
	saveTimer = window.setTimeout(() => {
		saveTimer = undefined;
		saveSettingsDraft();
	}, SETTINGS_DRAFT_SAVE_DELAY_MS);
};

export const flushSettingsDraftSave = (): void => {
	if (saveTimer === undefined && dirtyDraftPaths.size === 0) return;
	clearSaveTimer();
	saveSettingsDraft();
};

export const clearSettingsDraft = (): void => {
	clearSaveTimer();
	baseDraftPatch = {};
	dirtyDraftPaths.clear();
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
	} catch {
		// Storage can be unavailable in hardened browser contexts.
	}
};

const cloneSettingsPatch = (patch: SettingsPatch): SettingsPatch => ({ ...patch });

const writeSettingsPatch = (patch: SettingsPatch): void => {
	if (typeof window === "undefined") return;
	try {
		if (Object.keys(patch).length === 0) {
			window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
			return;
		}
		const draft: SettingsDraft = {
			schema: SETTINGS_DRAFT_SCHEMA,
			patch,
		};
		window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(draft));
	} catch {
		// Storage can be unavailable in hardened browser contexts.
	}
};

const readDraftStorage = (): string | undefined => {
	if (typeof window === "undefined") return undefined;
	try {
		return window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? undefined;
	} catch {
		return undefined;
	}
};

const parseSettingsDraft = (raw: string): SettingsDraft | undefined => {
	try {
		const candidate = JSON.parse(raw) as unknown;
		if (!isRecord(candidate)) return undefined;
		if (candidate["schema"] !== SETTINGS_DRAFT_SCHEMA) return undefined;
		const patch = parseSettingsPatch(candidate["patch"]);
		if (!patch) return undefined;
		return {
			schema: SETTINGS_DRAFT_SCHEMA,
			patch,
		};
	} catch {
		return undefined;
	}
};

const bindPageHideFlush = (): void => {
	if (pageHideBound || typeof window === "undefined") return;
	pageHideBound = true;
	window.addEventListener("pagehide", flushSettingsDraftSave, { passive: true });
};

const clearSaveTimer = (): void => {
	if (saveTimer === undefined || typeof window === "undefined") return;
	window.clearTimeout(saveTimer);
	saveTimer = undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
