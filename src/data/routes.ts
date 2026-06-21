import type { FeedItem, SitemapRoute } from "@/lib/seo";

export const SITE_ROUTES = [
	{
		path: "/",
		changeFrequency: "monthly",
		priority: 1,
	},
] satisfies SitemapRoute[];

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

export const FEED_ITEMS = [] satisfies FeedItem[];
