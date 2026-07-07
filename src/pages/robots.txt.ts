import { SITE } from "@/data/site";
import { absoluteSiteUrl } from "@/lib/seo";

const PUBLIC_PATHS = ["/", SITE.feeds.rss, SITE.feeds.json, SITE.feeds.llms] as const;
const CONTENT_SIGNAL = "Content-Signal: ai-train=yes, search=yes, ai-input=yes";

const CRAWLER_GROUPS = [
	{
		label: "All search engines and AI crawlers",
		agents: ["*"],
	},
	{
		label: "General",
		agents: [
			"Googlebot",
			"Googlebot-Image",
			"Googlebot-Video",
			"Googlebot-News",
			"Google-InspectionTool",
			"GoogleOther",
			"GoogleOther-Image",
			"GoogleOther-Video",
			"Google-CloudVertexBot",
			"Google-Extended",
			"Storebot-Google",
			"Bingbot",
			"DuckDuckBot",
			"DuckAssistBot",
			"Applebot",
			"Applebot-Extended",
			"CCBot",
		],
	},
	{
		label: "LLMs",
		agents: ["OAI-SearchBot", "GPTBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User"],
	},
] as const;

type CrawlerGroup = (typeof CRAWLER_GROUPS)[number];

const renderCrawlerGroup = (group: CrawlerGroup): string[] => [
	`# ${group.label}`,
	...group.agents.map((agent) => `User-agent: ${agent}`),
	CONTENT_SIGNAL,
	...PUBLIC_PATHS.map((path) => `Allow: ${path}`),
];
const renderCrawlerSections = (): string[] => {
	const lines: string[] = [];
	for (const group of CRAWLER_GROUPS) {
		lines.push("", ...renderCrawlerGroup(group));
	}
	return lines;
};

export const GET = (): Response =>
	new Response(
		["# Public discovery policy: allow search engines, AI crawlers, and user-triggered fetchers.", ...renderCrawlerSections(), "", `Sitemap: ${absoluteSiteUrl("/sitemap.xml")}`, ""].join("\n"),
		{
			headers: {
				"Cache-Control": "public, max-age=0, must-revalidate",
				"Content-Type": "text/plain; charset=utf-8",
				"X-Content-Type-Options": "nosniff",
			},
		},
	);
