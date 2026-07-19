import { fileURLToPath } from "node:url";

import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import { loadEnv } from "vite";

import { resolveSiteUrl } from "./src/lib/origin";

const root = fileURLToPath(new URL(".", import.meta.url));
const env = loadEnv(readAstroMode(process.argv), root, "");
const site = resolveSiteUrl(env["SITE_URL"]);
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
	session: {
		driver: {
			entrypoint: "unstorage/drivers/null",
		},
	},
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

function readAstroMode(arguments_: string[]): string {
	const modeIndex = arguments_.indexOf("--mode");
	const explicitMode = modeIndex >= 0 ? arguments_[modeIndex + 1]?.trim() : undefined;
	if (explicitMode) return explicitMode;
	return arguments_.some((argument) => argument === "dev") ? "development" : "production";
}
