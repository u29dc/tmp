export const RUNTIME_LOG_EVENT = "app:runtime-log";

export type RuntimeLogLevel = "error";

export type RuntimeLogEntry = {
	level: RuntimeLogLevel;
	source: string;
	message: string;
	error: Error;
	count: number;
	firstAt: number;
	lastAt: number;
};

type WindowWithReportError = Window & {
	reportError?: (error: unknown) => void;
};

const entries = new Map<string, RuntimeLogEntry>();

export const reportRuntimeError = (source: string, error: unknown): RuntimeLogEntry => {
	const normalized = normalizeError(source, error);
	const now = readNow();
	const key = `error\n${source}\n${normalized.message}`;
	const previous = entries.get(key);
	const entry: RuntimeLogEntry = previous
		? {
				...previous,
				count: previous.count + 1,
				lastAt: now,
			}
		: {
				level: "error",
				source,
				message: normalized.message,
				error: normalized,
				count: 1,
				firstAt: now,
				lastAt: now,
			};
	entries.set(key, entry);

	if (import.meta.env.DEV) {
		queueMicrotask(() => {
			throw normalized;
		});
	} else if (!previous) {
		publishRuntimeLog(entry);
	}

	return entry;
};

export const getRuntimeLogEntries = (): RuntimeLogEntry[] => Array.from(entries.values());

const normalizeError = (source: string, error: unknown): Error => {
	if (error instanceof Error) return error;
	const message = typeof error === "string" ? error : safeStringify(error);
	return new Error(`[app:${source}] ${message}`);
};

const publishRuntimeLog = (entry: RuntimeLogEntry): void => {
	if (typeof window === "undefined") return;
	try {
		window.dispatchEvent(new CustomEvent<RuntimeLogEntry>(RUNTIME_LOG_EVENT, { detail: entry }));
	} catch {
		// Runtime reporting must not become another runtime failure.
	}
	try {
		(window as WindowWithReportError).reportError?.(entry.error);
	} catch {
		// Browser error surfaces are best-effort.
	}
};

const readNow = (): number => (typeof performance === "undefined" ? Date.now() : performance.now());

const safeStringify = (value: unknown): string => {
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
};
