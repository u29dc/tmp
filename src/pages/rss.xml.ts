import { FEED_ITEMS } from "@/data/routes";
import { SITE } from "@/data/site";
import { absoluteSiteUrl, escapeXml, latestFeedDate, sortFeedItems, type FeedItem } from "@/lib/seo";

const buildItem = (item: FeedItem): string => {
	const url = absoluteSiteUrl(item.path);
	const guid = item.id ?? url;
	const isPermaLink = item.id === undefined;
	const categories = (item.tags ?? []).map((tag) => `\n\t\t<category>${escapeXml(tag)}</category>`).join("");

	return [
		"\t<item>",
		`\t\t<title>${escapeXml(item.title)}</title>`,
		`\t\t<link>${escapeXml(url)}</link>`,
		`\t\t<guid isPermaLink="${String(isPermaLink)}">${escapeXml(guid)}</guid>`,
		`\t\t<description>${escapeXml(item.description)}</description>`,
		`\t\t<pubDate>${item.date.toUTCString()}</pubDate>${categories}`,
		"\t</item>",
	].join("\n");
};

const buildFeed = (items: readonly FeedItem[]): string => {
	const sorted = sortFeedItems(items);
	const feedUrl = absoluteSiteUrl(SITE.feeds.rss);

	return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
	<title>${escapeXml(SITE.name)}</title>
	<link>${escapeXml(SITE.url)}</link>
	<description>${escapeXml(SITE.description)}</description>
	<language>${escapeXml(SITE.lang)}</language>
	<lastBuildDate>${latestFeedDate(sorted).toUTCString()}</lastBuildDate>
	<generator>Astro</generator>
	<ttl>1440</ttl>
	<atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${sorted.map(buildItem).join("\n")}
</channel>
</rss>
`;
};

export const GET = (): Response =>
	new Response(buildFeed(FEED_ITEMS), {
		headers: {
			"Cache-Control": "public, max-age=0, must-revalidate",
			"Content-Type": "application/rss+xml; charset=utf-8",
			"X-Content-Type-Options": "nosniff",
		},
	});
