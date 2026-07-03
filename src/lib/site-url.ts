export const DEFAULT_SITE_URL = "https://example.com";

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
