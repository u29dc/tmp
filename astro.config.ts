import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import { resolveSiteUrl } from "./src/lib/origin";

const site = resolveSiteUrl(process.env["SITE_URL"]);
const siteUrl = new URL(site);

export default defineConfig({
	site,
	adapter: cloudflare({
		configPath: "./wrangler.jsonc",
		imageService: "passthrough",
		prerenderEnvironment: "workerd",
	}),
	integrations: [mdx()],
	output: "static",
	compressHTML: true,
	prerenderConflictBehavior: "error",
	security: {
		checkOrigin: true,
		allowedDomains: [
			{
				protocol: "https",
				hostname: siteUrl.hostname,
			},
		],
		actionBodySizeLimit: 1024 * 1024,
		serverIslandBodySizeLimit: 1024 * 1024,
	},
	devToolbar: {
		enabled: false,
	},
	build: {
		inlineStylesheets: "never",
	},
	server: {
		host: "localhost",
		port: 3000,
	},
	vite: {
		build: {
			target: "baseline-widely-available",
			minify: "oxc",
			cssMinify: "lightningcss",
			sourcemap: false,
		},
		plugins: [tailwindcss()],
	},
});
