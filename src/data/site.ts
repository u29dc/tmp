export type SiteConfig = {
	name: string;
	title: string;
	description: string;
	url: string;
	lang: string;
	locale: string;
	creator: string;
	keywords: string[];
	themeColorLight: string;
	themeColorDark: string;
	ogImagePath: string;
};

export const SITE: SiteConfig = {
	name: "Website Template",
	title: "Website Template",
	description: "Placeholder architecture scaffold.",
	url: import.meta.env.SITE ?? "https://example.com",
	lang: "en-GB",
	locale: "en_GB",
	creator: "",
	keywords: ["website template"],
	themeColorLight: "#ffffff",
	themeColorDark: "#ffffff",
	ogImagePath: "/og-placeholder.svg",
};
