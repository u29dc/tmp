import type { SiteImage } from "@/data/media";
import { resolveSiteNamespace, resolveSiteUrl } from "@/lib/origin";
import type { SitePath } from "@/lib/seo";

export type SiteConfig = {
	name: string;
	shortName: string;
	title: string;
	description: string;
	url: string;
	namespace: string;
	updatedAt: Date;
	lang: string;
	locale: string;
	creator: string;
	organization: {
		name: string;
		url?: string;
		logo?: SiteImage;
		sameAs?: string[];
	};
	keywords: string[];
	faviconIcoPath: SitePath;
	appleTouchIconPath: SitePath;
	ogImage: SiteImage;
	icons: {
		src: SitePath;
		sizes: string;
		type: string;
		purpose: "any" | "maskable";
	}[];
	feeds: {
		rss: SitePath;
		json: SitePath;
		llms: SitePath;
	};
};

const siteUrl = resolveSiteUrl(import.meta.env.SITE_URL);
const siteName = "Website Template";

export const SITE: SiteConfig = {
	name: siteName,
	shortName: "Template",
	title: siteName,
	description: "Placeholder architecture scaffold.",
	url: siteUrl,
	namespace: resolveSiteNamespace(siteUrl, import.meta.env.SITE_NAMESPACE),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
	lang: "en-GB",
	locale: "en_GB",
	creator: "",
	organization: {
		name: siteName,
		url: siteUrl,
	},
	keywords: ["website template"],
	faviconIcoPath: "/favicon.ico",
	appleTouchIconPath: "/apple-touch-icon.png",
	ogImage: {
		path: "/og.png",
		type: "image/png",
		width: 1200,
		height: 630,
		alt: "Website Template placeholder social image",
	},
	icons: [
		{
			src: "/favicon.svg",
			sizes: "any",
			type: "image/svg+xml",
			purpose: "any",
		},
		{
			src: "/icon-16.png",
			sizes: "16x16",
			type: "image/png",
			purpose: "any",
		},
		{
			src: "/icon-32.png",
			sizes: "32x32",
			type: "image/png",
			purpose: "any",
		},
		{
			src: "/icon-96.png",
			sizes: "96x96",
			type: "image/png",
			purpose: "any",
		},
		{
			src: "/icon-192.png",
			sizes: "192x192",
			type: "image/png",
			purpose: "any",
		},
		{
			src: "/icon-512.png",
			sizes: "512x512",
			type: "image/png",
			purpose: "any",
		},
		{
			src: "/icon-192.png",
			sizes: "192x192",
			type: "image/png",
			purpose: "maskable",
		},
		{
			src: "/icon-512.png",
			sizes: "512x512",
			type: "image/png",
			purpose: "maskable",
		},
	],
	feeds: {
		rss: "/rss.xml",
		json: "/feed.json",
		llms: "/llms.txt",
	},
};
