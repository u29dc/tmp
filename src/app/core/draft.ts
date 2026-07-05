import { storageKey } from "@/app/core/namespace";
import { applySettingsPatch, createSettingsPatch, type SettingsPatch } from "@/app/core/settings";

const SETTINGS_DRAFT_SCHEMA = 1;
const SETTINGS_DRAFT_SAVE_DELAY_MS = 120;
const SETTINGS_STORAGE_KEY = storageKey("settings");

type SettingsDraft = {
	schema: typeof SETTINGS_DRAFT_SCHEMA;
	patch: SettingsPatch;
};

let saveTimer: number | undefined;
let pageHideBound = false;

export const loadSettingsDraft = (): void => {
	const raw = readDraftStorage();
	if (raw === undefined) return;
	const draft = parseSettingsDraft(raw);
	if (!draft) {
		clearSettingsDraft();
		return;
	}
	applySettingsPatch(draft.patch);
};

export const saveSettingsDraft = (): void => {
	writeSettingsPatch(createSettingsPatch());
};

export const scheduleSettingsDraftSave = (): void => {
	if (typeof window === "undefined") return;
	bindPageHideFlush();
	clearSaveTimer();
	saveTimer = window.setTimeout(() => {
		saveTimer = undefined;
		saveSettingsDraft();
	}, SETTINGS_DRAFT_SAVE_DELAY_MS);
};

export const flushSettingsDraftSave = (): void => {
	if (saveTimer === undefined) return;
	clearSaveTimer();
	saveSettingsDraft();
};

export const clearSettingsDraft = (): void => {
	clearSaveTimer();
	if (typeof window === "undefined") return;
	try {
		window.localStorage.removeItem(SETTINGS_STORAGE_KEY);
	} catch {
		// Storage can be unavailable in hardened browser contexts.
	}
};

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
		const patch = candidate["patch"];
		if (!isSettingsPatch(patch)) return undefined;
		return {
			schema: SETTINGS_DRAFT_SCHEMA,
			patch,
		};
	} catch {
		return undefined;
	}
};

const isSettingsPatch = (value: unknown): value is SettingsPatch => {
	if (!isRecord(value)) return false;
	for (const patchValue of Object.values(value)) {
		if (typeof patchValue !== "boolean" && typeof patchValue !== "number" && typeof patchValue !== "string") return false;
	}
	return true;
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
