import { FEED_ITEMS } from "@/data/routes";
import { SITE } from "@/data/site";
import { absoluteSiteUrl, sortFeedItems, type FeedItem } from "@/lib/seo";

type JsonFeedAuthor = {
	name: string;
	url: string;
};

type JsonFeedItem = {
	id: string;
	url: string;
	title: string;
	summary: string;
	content_text: string;
	date_published: string;
	tags?: string[];
};

type JsonFeed = {
	version: "https://jsonfeed.org/version/1.1";
	title: string;
	home_page_url: string;
	feed_url: string;
	description: string;
	language: string;
	authors?: JsonFeedAuthor[];
	items: JsonFeedItem[];
};

const buildItem = (item: FeedItem): JsonFeedItem => {
	const url = absoluteSiteUrl(item.path);

	return {
		id: item.id ?? url,
		url,
		title: item.title,
		summary: item.description,
		content_text: item.contentText ?? item.description,
		date_published: item.date.toISOString(),
		...(item.tags ? { tags: item.tags } : {}),
	};
};

const buildFeed = (items: readonly FeedItem[]): JsonFeed => ({
	version: "https://jsonfeed.org/version/1.1",
	title: SITE.name,
	home_page_url: SITE.url,
	feed_url: absoluteSiteUrl(SITE.feeds.json),
	description: SITE.description,
	language: SITE.lang,
	...(SITE.creator ? { authors: [{ name: SITE.creator, url: SITE.url }] } : {}),
	items: sortFeedItems(items).map(buildItem),
});

export const GET = (): Response =>
	new Response(JSON.stringify(buildFeed(FEED_ITEMS)), {
		headers: {
			"Cache-Control": "public, max-age=0, must-revalidate",
			"Content-Type": "application/feed+json; charset=utf-8",
			"X-Content-Type-Options": "nosniff",
		},
	});
