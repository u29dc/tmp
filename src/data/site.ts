export type SiteConfig = {
	name: string;
	shortName: string;
	title: string;
	description: string;
	url: string;
	lang: string;
	locale: string;
	creator: string;
	keywords: string[];
	themeColorLight: string;
	themeColorDark: string;
	backgroundColor: string;
	faviconIcoPath: `/${string}`;
	appleTouchIconPath: `/${string}`;
	ogImage: {
		path: `/${string}`;
		type: string;
		width: number;
		height: number;
		alt: string;
	};
	icons: {
		src: `/${string}`;
		sizes: string;
		type: string;
		purpose: "any" | "maskable";
	}[];
	feeds: {
		rss: `/${string}`;
		json: `/${string}`;
		llms: `/${string}`;
	};
};

const normalizeSiteUrl = (value: string): string => {
	const trimmed = value.trim();
	if (!trimmed) throw new Error("SITE_URL cannot be empty");

	let url: URL;
	try {
		url = new URL(trimmed);
	} catch {
		throw new Error("SITE_URL must be an absolute URL");
	}

	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new Error("SITE_URL must use http or https");
	}

	if (url.username || url.password || url.search || url.hash) {
		throw new Error("SITE_URL must not include credentials, query, or hash");
	}

	url.pathname = url.pathname.replace(/\/+$/, "") || "/";
	return url.toString().replace(/\/$/, "");
};

export const SITE: SiteConfig = {
	name: "Website Template",
	shortName: "Template",
	title: "Website Template",
	description: "Placeholder architecture scaffold.",
	url: normalizeSiteUrl(
		String(import.meta.env.SITE ?? import.meta.env.SITE_URL ?? "https://example.com"),
	),
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
