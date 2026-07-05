import type { SiteImageOverride } from "@/data/media";
import { SITE } from "@/data/site";
import { normalizeSitePath, type ChangeFrequency, type FeedItem, type SitemapRoute, type SitePath } from "@/lib/seo";

export type PageSitemap = {
	lastModified?: Date;
	changeFrequency?: ChangeFrequency;
	priority?: number;
};

export type PageFeed = {
	date?: Date;
	id?: string;
	title?: string;
	description?: string;
	tags?: string[];
	contentText?: string;
};

export type PageMetadata = {
	path: SitePath;
	title: string;
	description: string;
	noindex?: boolean;
	sitemap?: false | PageSitemap;
	feed?: false | PageFeed;
	image?: SiteImageOverride;
	publishedTime?: Date;
	modifiedTime?: Date;
};

export const PAGES: readonly PageMetadata[] = [
	{
		path: "/",
		title: SITE.title,
		description: SITE.description,
		modifiedTime: SITE.updatedAt,
		sitemap: {
			changeFrequency: "monthly",
			priority: 1,
		},
	},
	{
		path: "/about/",
		title: "About",
		description: SITE.description,
		noindex: true,
		sitemap: false,
		feed: false,
		modifiedTime: SITE.updatedAt,
	},
];

export const SYSTEM_ROUTES = [
	{
		path: "/rss.xml",
		changeFrequency: "weekly",
		priority: 0.2,
	},
	{
		path: "/feed.json",
		changeFrequency: "weekly",
		priority: 0.2,
	},
	{
		path: "/llms.txt",
		changeFrequency: "weekly",
		priority: 0.2,
	},
] satisfies SitemapRoute[];

export const normalizePagePath = (value: string): SitePath => {
	try {
		const path = value.startsWith("http") ? new URL(value).pathname : value;
		return normalizeSitePath(path, "page path");
	} catch {
		return "/";
	}
};

export const getPageByPath = (path: string): PageMetadata | undefined => {
	const normalized = normalizePagePath(path);
	return PAGES.find((page) => normalizePagePath(page.path) === normalized);
};

export const PUBLIC_PAGES = PAGES.filter((page) => !page.noindex);

export const SITE_ROUTES = PAGES.flatMap((page): SitemapRoute[] => {
	if (page.noindex || page.sitemap === false) return [];
	const sitemap = page.sitemap ?? {};
	const lastModified = sitemap.lastModified ?? page.modifiedTime;
	return [
		{
			path: page.path,
			...(lastModified ? { lastModified } : {}),
			...(sitemap.changeFrequency ? { changeFrequency: sitemap.changeFrequency } : {}),
			...(sitemap.priority !== undefined ? { priority: sitemap.priority } : {}),
		},
	];
});

export const FEED_ITEMS = PAGES.flatMap((page): FeedItem[] => {
	const feed = page.feed;
	if (!feed) return [];
	return [
		{
			path: page.path,
			title: feed.title ?? page.title,
			description: feed.description ?? page.description,
			date: feed.date ?? page.publishedTime ?? page.modifiedTime ?? SITE.updatedAt,
			...(feed.id !== undefined ? { id: feed.id } : {}),
			...(feed.tags !== undefined ? { tags: feed.tags } : {}),
			...(feed.contentText !== undefined ? { contentText: feed.contentText } : {}),
		},
	];
});
