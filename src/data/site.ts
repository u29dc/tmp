import type { SiteImage } from "@/data/media";
import type { SitePath } from "@/lib/seo";
import { resolveSiteNamespace, resolveSiteUrl } from "@/lib/origin";

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
	keywords: string[];
	themeColorLight: string;
	themeColorDark: string;
	backgroundColor: string;
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

export const SITE: SiteConfig = {
	name: "Website Template",
	shortName: "Template",
	title: "Website Template",
	description: "Placeholder architecture scaffold.",
	url: siteUrl,
	namespace: resolveSiteNamespace(siteUrl, import.meta.env.SITE_NAMESPACE),
	updatedAt: new Date("2026-01-01T00:00:00.000Z"),
	lang: "en-GB",
	locale: "en_GB",
	creator: "",
	keywords: ["website template"],
	themeColorLight: "#ffffff",
	themeColorDark: "#111111",
	backgroundColor: "#ffffff",
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
