export type FlagSource = "query" | "session" | "default";

export type BooleanFlagState = {
	enabled: boolean;
	source: FlagSource;
	explicit: boolean;
};

export type BooleanFlagOptions = {
	param: string;
	storageKey: string;
	persistence?: "none" | "session";
	defaultValue?: boolean;
};

export type BooleanFlag = {
	sync: (search?: string) => BooleanFlagState;
	clear: () => void;
};

const TRUE_VALUES = new Set(["1", "true", "on"]);
const FALSE_VALUES = new Set(["0", "false", "off"]);

export const createBooleanFlag = ({ param, storageKey, persistence = "none", defaultValue = false }: BooleanFlagOptions): BooleanFlag => {
	const storageEnabled = persistence === "session";

	const readDefault = (): BooleanFlagState => ({
		enabled: defaultValue,
		source: "default",
		explicit: false,
	});

	const readSession = (): BooleanFlagState | undefined => {
		if (!storageEnabled || typeof window === "undefined") return undefined;
		try {
			const stored = window.sessionStorage.getItem(storageKey);
			if (stored === null) return undefined;
			const enabled = parseBooleanValue(stored);
			if (enabled === undefined) return undefined;
			return {
				enabled,
				source: "session",
				explicit: true,
			};
		} catch {
			return undefined;
		}
	};

	const writeSession = (enabled: boolean): void => {
		if (!storageEnabled || typeof window === "undefined") return;
		try {
			window.sessionStorage.setItem(storageKey, enabled ? "1" : "0");
		} catch {
			// Storage can be unavailable in hardened browser contexts.
		}
	};

	const clear = (): void => {
		if (!storageEnabled || typeof window === "undefined") return;
		try {
			window.sessionStorage.removeItem(storageKey);
		} catch {
			// Storage can be unavailable in hardened browser contexts.
		}
	};

	return {
		sync(search = readLocationSearch()): BooleanFlagState {
			const queryValue = readQueryValue(search, param);
			if (queryValue !== undefined) {
				const enabled = parseBooleanValue(queryValue);
				if (enabled !== undefined) {
					writeSession(enabled);
					return {
						enabled,
						source: "query",
						explicit: true,
					};
				}
			}
			return readSession() ?? readDefault();
		},
		clear,
	};
};

const readLocationSearch = (): string => {
	if (typeof window === "undefined") return "";
	return window.location.search;
};

const readQueryValue = (search: string, param: string): string | undefined => {
	if (!search || typeof URLSearchParams === "undefined") return undefined;
	const params = new URLSearchParams(search);
	if (!params.has(param)) return undefined;
	return params.get(param) ?? "";
};

const parseBooleanValue = (value: string): boolean | undefined => {
	const normalized = value.trim().toLowerCase();
	if (TRUE_VALUES.has(normalized)) return true;
	if (FALSE_VALUES.has(normalized)) return false;
	return undefined;
};
