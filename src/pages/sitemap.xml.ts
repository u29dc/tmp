import { SITE_ROUTES, SYSTEM_ROUTES } from "@/data/routes";
import { SITE } from "@/data/site";
import { absoluteSiteUrl, escapeXml, type SitemapRoute } from "@/lib/seo";

const formatPriority = (value: number): string => (Number.isInteger(value) ? value.toFixed(1) : String(value));

const buildUrl = (entry: SitemapRoute): string => {
	const lastModified = entry.lastModified ? `\n\t<lastmod>${entry.lastModified.toISOString()}</lastmod>` : "";
	const changeFrequency = entry.changeFrequency ? `\n\t<changefreq>${entry.changeFrequency}</changefreq>` : "";
	const priority = entry.priority === undefined ? "" : `\n\t<priority>${formatPriority(entry.priority)}</priority>`;

	return `\n<url>\n\t<loc>${escapeXml(absoluteSiteUrl(entry.path, SITE.url))}</loc>${lastModified}${changeFrequency}${priority}\n</url>`;
};

const buildSitemap = (entries: readonly SitemapRoute[]): string =>
	`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.map(buildUrl).join("")}\n</urlset>\n`;

export const GET = (): Response =>
	new Response(buildSitemap([...SITE_ROUTES, ...SYSTEM_ROUTES]), {
		headers: {
			"Cache-Control": "public, max-age=0, must-revalidate",
			"Content-Type": "application/xml; charset=utf-8",
			"X-Content-Type-Options": "nosniff",
		},
	});
