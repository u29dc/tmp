import { createDefaultSettings } from "@/app/core/settings";
import { SITE } from "@/data/site";

const defaultTheme = createDefaultSettings().theme;

const manifest = {
	name: SITE.name,
	short_name: SITE.shortName,
	description: SITE.description,
	start_url: "/",
	display: "standalone",
	background_color: defaultTheme.light.ground,
	theme_color: defaultTheme.light.ground,
	icons: SITE.icons,
	orientation: "portrait",
	categories: SITE.keywords,
	lang: SITE.lang,
} as const;

export const GET = (): Response =>
	new Response(JSON.stringify(manifest), {
		headers: {
			"Cache-Control": "public, max-age=0, must-revalidate",
			"Content-Type": "application/manifest+json; charset=utf-8",
			"X-Content-Type-Options": "nosniff",
		},
	});
