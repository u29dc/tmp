export const DEFAULT_SITE_URL = "https://example.com";

const ENVIRONMENT_LABELS = new Set(["dev", "preview", "staging", "test", "www"]);
const PUBLIC_SUFFIX_PAIRS = new Set([
	"ac.uk",
	"co.jp",
	"co.uk",
	"com.au",
	"com.br",
	"com.tr",
	"com.ua",
	"com.cn",
	"net.au",
	"net.cn",
	"net.nz",
	"org.au",
	"org.cn",
	"org.nz",
]);
const NAMESPACE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const normalizeSiteUrl = (value: string): string => {
	const trimmed = value.trim();
	if (!trimmed) throw new Error("SITE_URL cannot be empty");
	if (trimmed.includes("?") || trimmed.includes("#")) {
		throw new Error("SITE_URL must not include credentials, query, or hash");
	}

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		throw new Error("SITE_URL must be an absolute URL");
	}

	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new Error("SITE_URL must use http or https");
	}

	if (url.username || url.password || url.search || url.hash) {
		throw new Error("SITE_URL must not include credentials, query, or hash");
	}

	const pathname = url.pathname.replace(/\/+$/, "") || "/";
	if (pathname !== "/") {
		throw new Error(
			"SITE_URL must not include a path; configure Astro base separately if subpath deploy support is added",
		);
	}
	url.pathname = "/";
	return url.toString().replace(/\/$/, "");
};

export const resolveSiteUrl = (value?: string): string =>
	normalizeSiteUrl(value ?? DEFAULT_SITE_URL);

export const resolveSiteNamespace = (siteUrl: string, override?: string): string => {
	const custom = override?.trim().toLowerCase();
	if (custom) {
		if (!NAMESPACE_PATTERN.test(custom)) {
			throw new Error("SITE_NAMESPACE must use lowercase letters, numbers, and hyphens");
		}
		return custom;
	}

	const hostname = new URL(normalizeSiteUrl(siteUrl)).hostname.toLowerCase();
	const labels = hostname.split(".").filter(Boolean);
	while (labels.length > 1 && ENVIRONMENT_LABELS.has(labels[0] ?? "")) labels.shift();
	if (labels.length === 0) return "site";
	if (labels.length === 1) return normalizeNamespaceLabel(labels[0] ?? "site");

	const suffix = labels.slice(-2).join(".");
	const labelIndex = PUBLIC_SUFFIX_PAIRS.has(suffix) ? labels.length - 3 : labels.length - 2;
	return normalizeNamespaceLabel(labels[Math.max(0, labelIndex)] ?? "site");
};

const normalizeNamespaceLabel = (value: string): string => {
	const namespace = value
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
	return namespace || "site";
};
