(() => {
	const THEME_SCHEMA = 1;
	const TRUE_VALUES = new Set(["1", "true", "on"]);
	const FALSE_VALUES = new Set(["0", "false", "off"]);
	const COLOR_KEYS = ["ground", "ink"];

	const root = document.documentElement;
	const namespace = root.dataset.siteNamespace || "site";
	const controlsKey = `${namespace}:controls`;
	const settingsKey = `${namespace}:settings`;
	const theme = readThemeDefaults(root.dataset.themeSettings);
	if (!theme) return;

	const controlsEnabled = readControls(controlsKey, root.dataset.controlsDefault === "true");
	if (controlsEnabled) mergeThemePatch(theme, readStoredSettings(settingsKey));
	mergeThemePatch(theme, readQuerySettings());
	applyTheme(theme);

	function readControls(key, defaultValue) {
		const query = readQueryValue("controls");
		const queryState = parseBoolean(query);
		if (queryState !== undefined) {
			writeSession(key, queryState ? "1" : "0");
			return queryState;
		}
		const stored = parseBoolean(readSession(key));
		return stored ?? defaultValue;
	}

	function readThemeDefaults(raw) {
		const candidate = parseJson(raw);
		if (!candidate || !isRecord(candidate)) return undefined;
		const theme = {
			mode: readMode(candidate.mode) ?? "system",
			light: readColors(candidate.light),
			dark: readColors(candidate.dark),
		};
		if (!theme.light || !theme.dark) return undefined;
		return theme;
	}

	function readStoredSettings(key) {
		const stored = readLocal(key);
		const candidate = parseJson(stored);
		if (!candidate || !isRecord(candidate)) return undefined;
		if (candidate.schema !== THEME_SCHEMA || !isRecord(candidate.patch)) return undefined;
		return candidate.patch;
	}

	function readQuerySettings() {
		if (!window.URLSearchParams) return undefined;
		const patch = {};
		const query = new URLSearchParams(window.location.search);
		for (const [key, value] of query.entries()) {
			if (isThemePath(key)) patch[key] = value;
		}
		return patch;
	}

	function mergeThemePatch(theme, patch) {
		if (!isRecord(patch)) return;
		for (const [path, value] of Object.entries(patch)) {
			if (path === "theme.mode") {
				const mode = readMode(value);
				if (mode) theme.mode = mode;
				continue;
			}
			const colorPath = readColorPath(path);
			if (!colorPath) continue;
			const color = readColor(value);
			if (color) theme[colorPath.scheme][colorPath.key] = color;
		}
	}

	function applyTheme(theme) {
		const scheme =
			theme.mode === "light" || theme.mode === "dark" ? theme.mode : readSystemScheme();
		const colors = scheme === "dark" ? theme.dark : theme.light;
		root.dataset.theme = scheme;
		root.dataset.themeMode = theme.mode;
		root.style.setProperty("color-scheme", scheme);
		root.style.setProperty("background-color", "var(--site-ground)");
		root.style.setProperty("color", "var(--site-ink)");
		root.style.setProperty("--site-ground", colors.ground);
		root.style.setProperty("--site-ink", colors.ink);
		root.style.setProperty("--site-selection-bg", colors.ink);
		root.style.setProperty("--site-selection-fg", colors.ground);
		updateColorSchemeMeta(scheme);
		updateThemeColorMeta(colors.ground);
	}

	function readColors(value) {
		if (!isRecord(value)) return undefined;
		const colors = {};
		for (const key of COLOR_KEYS) {
			const color = readColor(value[key]);
			if (!color) return undefined;
			colors[key] = color;
		}
		return colors;
	}

	function readMode(value) {
		if (value === "system" || value === "light" || value === "dark") return value;
		return undefined;
	}

	function readColor(value) {
		if (typeof value !== "string" || !value.trim()) return undefined;
		const color = value.trim();
		if (
			window.CSS &&
			typeof window.CSS.supports === "function" &&
			!window.CSS.supports("color", color)
		)
			return undefined;
		return color;
	}

	function readColorPath(path) {
		const match = /^theme\.(light|dark)\.([a-zA-Z]+)$/.exec(path);
		if (!match) return undefined;
		const key = match[2];
		if (!COLOR_KEYS.includes(key)) return undefined;
		return {
			scheme: match[1],
			key,
		};
	}

	function isThemePath(path) {
		return path === "theme.mode" || Boolean(readColorPath(path));
	}

	function readSystemScheme() {
		return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	}

	function updateColorSchemeMeta(scheme) {
		const meta = document.querySelector("meta[name='color-scheme']");
		if (meta) meta.content = scheme;
	}

	function updateThemeColorMeta(color) {
		let meta = document.querySelector("meta[name='theme-color'][data-runtime-theme-color]");
		if (!meta) {
			meta = document.createElement("meta");
			meta.name = "theme-color";
			meta.dataset.runtimeThemeColor = "true";
			document.head.append(meta);
		}
		meta.content = color;
	}

	function readQueryValue(name) {
		if (!window.URLSearchParams) return undefined;
		const query = new URLSearchParams(window.location.search);
		if (!query.has(name)) return undefined;
		return query.get(name) ?? "";
	}

	function parseBoolean(value) {
		if (typeof value !== "string") return undefined;
		const normalized = value.trim().toLowerCase();
		if (TRUE_VALUES.has(normalized)) return true;
		if (FALSE_VALUES.has(normalized)) return false;
		return undefined;
	}

	function readSession(key) {
		try {
			return window.sessionStorage.getItem(key) ?? undefined;
		} catch {
			return undefined;
		}
	}

	function writeSession(key, value) {
		try {
			window.sessionStorage.setItem(key, value);
		} catch {
			// Storage can be unavailable in hardened browser contexts.
		}
	}

	function readLocal(key) {
		try {
			return window.localStorage.getItem(key) ?? undefined;
		} catch {
			return undefined;
		}
	}

	function parseJson(raw) {
		if (typeof raw !== "string" || !raw) return undefined;
		try {
			return JSON.parse(raw);
		} catch {
			return undefined;
		}
	}

	function isRecord(value) {
		return Boolean(value) && typeof value === "object" && !Array.isArray(value);
	}
})();
