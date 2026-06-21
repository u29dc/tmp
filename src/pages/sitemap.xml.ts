import { SITE } from "@/data/site";

export const GET = (): Response =>
	new Response(
		`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${new URL("/", SITE.url).toString()}</loc>\n  </url>\n</urlset>\n`,
		{
			headers: {
				"Content-Type": "application/xml; charset=utf-8",
			},
		},
	);
