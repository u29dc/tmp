import { SITE } from "@/data/site";
import { absoluteUrl } from "@/lib/seo";

export const GET = (): Response =>
	new Response(
		[
			"User-agent: *",
			"Allow: /",
			`Allow: ${SITE.feeds.rss}`,
			`Allow: ${SITE.feeds.json}`,
			`Allow: ${SITE.feeds.llms}`,
			"",
			`Sitemap: ${absoluteUrl("/sitemap.xml")}`,
			"",
		].join("\n"),
		{
			headers: {
				"Cache-Control": "public, max-age=0, must-revalidate",
				"Content-Type": "text/plain; charset=utf-8",
				"X-Content-Type-Options": "nosniff",
			},
		},
	);
