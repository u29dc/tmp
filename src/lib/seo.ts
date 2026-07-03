import { SITE } from "@/data/site";

export type SitePath = `/${string}`;

export type ChangeFrequency =
	| "always"
	| "hourly"
	| "daily"
	| "weekly"
	| "monthly"
	| "yearly"
	| "never";

export type SitemapRoute = {
	path: SitePath;
	lastModified?: Date;
	changeFrequency?: ChangeFrequency;
	priority?: number;
};

export type FeedItem = {
	path: SitePath;
	title: string;
	description: string;
	date: Date;
	id?: string;
	tags?: string[];
	contentText?: string;
};

export const isSitePath = (value: string): value is SitePath =>
	value.startsWith("/") && !value.startsWith("//") && !/[?#]/.test(value);

export const assertSitePath = (value: string, label = "site path"): SitePath => {
	if (isSitePath(value)) return value;
	throw new Error(`${label} must be a root-relative path without protocol, query, or hash`);
};

export const normalizeSitePath = (value: string, label = "site path"): SitePath => {
	if (/^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith("//")) {
		throw new Error(`${label} must be site-local`);
	}
	const [pathname = "/"] = value.split(/[?#]/);
	const prefixed = pathname.startsWith("/") ? pathname : `/${pathname}`;
	return assertSitePath(prefixed.replace(/\/+$/, "") || "/", label);
};

export const absoluteSiteUrl = (path: string, base = SITE.url): string =>
	new URL(assertSitePath(path), base).toString();

export const escapeXml = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");

export const sortFeedItems = (items: readonly FeedItem[]): FeedItem[] =>
	[...items].sort((a, b) => b.date.getTime() - a.date.getTime());

export const latestFeedDate = (items: readonly FeedItem[], fallback = SITE.updatedAt): Date =>
	sortFeedItems(items)[0]?.date ?? fallback;
