import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

const site = process.env["SITE_URL"] ?? "https://example.com";

export default defineConfig({
	site,
	adapter: cloudflare({
		imageService: "passthrough",
		prerenderEnvironment: "node",
	}),
	integrations: [mdx()],
	output: "static",
	compressHTML: true,
	prerenderConflictBehavior: "error",
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
			minify: "esbuild",
		},
		plugins: [tailwindcss()],
	},
});
