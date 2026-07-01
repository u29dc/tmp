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

export const absoluteUrl = (pathOrUrl: string, base = SITE.url): string => {
	try {
		return new URL(pathOrUrl).toString();
	} catch {
		return new URL(pathOrUrl, base).toString();
	}
};

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
