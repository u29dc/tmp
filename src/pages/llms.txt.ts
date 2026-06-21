import { SITE } from "@/data/site";
import { SITE_ROUTES } from "@/data/routes";
import { absoluteUrl } from "@/lib/seo";

const routeLines = SITE_ROUTES.map((route) => `- ${absoluteUrl(route.path)}`).join("\n");

const body = [
	`# ${SITE.name}`,
	SITE.description,
	"## Public Routes",
	routeLines,
	"## Feeds",
	`- RSS: ${absoluteUrl(SITE.feeds.rss)}`,
	`- JSON Feed: ${absoluteUrl(SITE.feeds.json)}`,
	`- Sitemap: ${absoluteUrl("/sitemap.xml")}`,
].join("\n\n");

export const GET = (): Response =>
	new Response(`${body}\n`, {
		headers: {
			"Cache-Control": "public, max-age=0, must-revalidate",
			"Content-Type": "text/plain; charset=utf-8",
			"X-Content-Type-Options": "nosniff",
		},
	});
