export type StorageKeyName = "controls" | "settings";

const FALLBACK_SITE_NAMESPACE = "site";
const NAMESPACE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const readSiteNamespace = (): string => {
	if (typeof document === "undefined") return FALLBACK_SITE_NAMESPACE;
	return normalizeSiteNamespace(document.documentElement.dataset["siteNamespace"]);
};

export const storageKey = (name: StorageKeyName): string => `${readSiteNamespace()}:${name}`;

const normalizeSiteNamespace = (value: unknown): string => {
	if (typeof value !== "string") return FALLBACK_SITE_NAMESPACE;
	const namespace = value.trim().toLowerCase();
	return NAMESPACE_PATTERN.test(namespace) ? namespace : FALLBACK_SITE_NAMESPACE;
};
