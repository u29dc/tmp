import { SITE } from "@/data/site";

export const GET = (): Response =>
	new Response(
		`User-agent: *\nAllow: /\n\nSitemap: ${new URL("/sitemap.xml", SITE.url).toString()}\n`,
		{
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
			},
		},
	);
