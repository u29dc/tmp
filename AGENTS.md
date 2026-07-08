> This repository is an Astro website architecture with a custom TypeScript runtime for input, scroll, motion, routing, theme, controls, metadata, and static deployment behavior.

## 1. Documentation

- Runtime entry: [`src/app/app.ts`](src/app/app.ts)
- Runtime loop: [`src/app/core/app.ts`](src/app/core/app.ts)
- Runtime settings: [`src/app/core/settings.ts`](src/app/core/settings.ts)
- Site metadata: [`src/data/site.ts`](src/data/site.ts)
- Page registry: [`src/data/pages.ts`](src/data/pages.ts)
- Document shell: [`src/layouts/BaseLayout.astro`](src/layouts/BaseLayout.astro)
- Security headers: [`public/_headers`](public/_headers)
- Compatibility mirrors: [`README.md`](README.md) and [`CLAUDE.md`](CLAUDE.md) currently point to this file.

## 2. Repository Structure

```text
.
├── src/app/       browser runtime modules and controls
├── src/data/      site, page, media, feed, and route metadata
├── src/layouts/   Astro document shell and SEO output
├── src/lib/       shared URL, metadata, feed, and schema helpers
├── src/pages/     route files, metadata endpoints, and fixtures
├── src/styles/    font imports, tokens, Tailwind layers, and base styles
├── public/        static assets, headers, fonts, icons, and boot script
├── scripts/       build and post-build utilities
└── AGENTS.md      repo-level agent operating contract
```

- Use [`src/data/`](src/data) as the default integration point for project content, CMS-derived data, feeds, and SEO metadata.
- Keep runtime behavior in [`src/app/`](src/app); avoid spreading browser listeners or settings mutation through page files.
- Keep document-level concerns in [`src/layouts/BaseLayout.astro`](src/layouts/BaseLayout.astro), including metadata, router wiring, and first-paint boot placement.

## 3. Stack

| Layer           | Choice                                        | Notes                                                          |
| --------------- | --------------------------------------------- | -------------------------------------------------------------- |
| Runtime         | Bun + Astro                                   | static output with client-side runtime enhancement             |
| Styling         | Tailwind v4 + CSS tokens                      | tokens own first-paint color, spacing, type, and motion values |
| Browser runtime | TypeScript modules under `src/app`            | no framework component state for core interaction behavior     |
| Controls        | cfg under `src/app/dev`                       | settings surface enabled by default until disabled per session |
| Deployment      | Cloudflare adapter + static build             | headers live in [`public/_headers`](public/_headers)           |
| Validation      | oxfmt, oxlint, Astro check, TypeScript, build | run through `bun run util:check`                               |

## 4. Commands

- `bun install` - install dependencies and hooks.
- `bun run dev` - regenerate the first-paint boot script and run the Astro dev server.
- `bun run build` - regenerate the first-paint boot script, build static output, and run the post-build minifier.
- `bun run cf:deploy` - run the full utility check gate and deploy with Wrangler.
- `bun run cf:deploy:dry` - build and run a Wrangler deploy dry-run.
- `bun run cf:dev` - build and run the Cloudflare local worker preview.
- `bun run cf:types` - regenerate `wrangler.d.ts`.
- `bun run util:clean` - remove generated build and tool caches.
- `bun run util:format` - format supported source files with `oxfmt`.
- `bun run util:lint` - lint source with `oxlint`.
- `bun run util:types` - run Astro, TypeScript, and Cloudflare type checks.
- `bun run util:check` - format, lint, typecheck, build, and minify.

## 5. Architecture

- [`src/app/core/app.ts`](src/app/core/app.ts): owns the single visible `requestAnimationFrame` loop, lifecycle ordering, visibility handling, resize handling, and frame scheduling.
- [`src/app/core/module.ts`](src/app/core/module.ts): defines module lifecycle hooks: `preInit`, `init`, `resize`, `update`, and `dispose`.
- [`src/app/core/logger.ts`](src/app/core/logger.ts): centralizes browser runtime error reporting and keeps production error handling observable without scattered console calls.
- [`src/app/systems/input.ts`](src/app/systems/input.ts): owns browser input listeners, passive snapshots, and input intent channels. Other systems should consume input state instead of binding duplicate pointer, wheel, keyboard, or click listeners.
- [`src/app/systems/scroll.ts`](src/app/systems/scroll.ts): owns native-backed smooth wheel enhancement, anchors, and `[data-scroll]` ranges.
- [`src/app/systems/motion.ts`](src/app/systems/motion.ts): owns small cancellable motion scheduling for route and page choreography.
- [`src/app/systems/route.ts`](src/app/systems/route.ts): owns Astro transition events and route state.
- [`src/app/systems/theme.ts`](src/app/systems/theme.ts): applies runtime theme settings, CSS variables, `color-scheme`, and runtime theme metadata.
- [`src/app/boot.ts`](src/app/boot.ts): typed source for the generated first-paint boot script.
- `public/boot.js`: ignored generated classic script that applies only first-paint theme mode plus main background/text colors before CSS loads.
- [`src/app/core/namespace.ts`](src/app/core/namespace.ts): derives project-scoped browser storage keys from the rendered `data-site-namespace`.
- [`src/app/core/draft.ts`](src/app/core/draft.ts): persists the local controls settings patch.
- [`src/lib/origin.ts`](src/lib/origin.ts): normalizes `SITE_URL` and derives `SITE.namespace`.
- [`src/lib/seo.ts`](src/lib/seo.ts) and [`src/lib/schema.ts`](src/lib/schema.ts): own URL, feed, XML, and JSON-LD helpers.

## 6. Runtime And State

- Runtime state is wired through `data-*` attributes and CSS variables, not framework component state.
- `settings.ts` is the canonical source for hardcoded runtime defaults.
- URL query settings apply after defaults and after the local controls patch.
- Controls use browser keys named `${site namespace}:controls` and `${site namespace}:settings`.
- `${site namespace}:controls` is a session flag for the controls surface.
- `${site namespace}:settings` is a local versioned settings patch; it is not production configuration.
- Controls are enabled by default in dev and built deployments, disabled for the current browser session with `?controls=0`, and re-enabled after session opt-out with `?controls=1`.
- Reset Settings clears `${site namespace}:settings`, reapplies hardcoded defaults, and leaves `${site namespace}:controls` unchanged.
- Native scroll is the fallback; smooth scrolling is an enhancement gated by settings, device, network, pointer, and motion profile.
- `settings.runtime.continuous` controls whether the runtime loop stays active while the document is visible. It defaults to `true`; set it to `false` only when deliberately testing demand-driven scheduling.

## 7. Conventions

- Use the `@/*` alias for internal imports from `src`.
- Keep CSS tokens in [`src/styles/tokens.css`](src/styles/tokens.css); runtime numeric settings belong in [`src/app/core/settings.ts`](src/app/core/settings.ts).
- Keep first-paint theme values aligned between [`src/styles/tokens.css`](src/styles/tokens.css), [`src/app/core/settings.ts`](src/app/core/settings.ts), and [`src/app/boot.ts`](src/app/boot.ts).
- Put project-specific metadata, route entries, feed items, and CMS adapters behind [`src/data/`](src/data) or a replacement data source.
- Keep page files thin: route composition belongs in `src/pages`, shared behavior belongs in runtime, data, layout, or library modules.
- Use scoped Conventional Commits such as `feat(runtime): add scroll range state`.

## 8. Constraints

- Treat [`public/_headers`](public/_headers) as deployment-critical. HSTS preload and cross-origin policies should be checked before attaching a real domain.
- Treat root [`wrangler.jsonc`](wrangler.jsonc) as the Astro Cloudflare adapter input. Deploy through the package scripts so Astro generates the final `dist/client/wrangler.json` config before Wrangler runs.
- Keep controls removable before final launch when a site should not expose local/staging tuning controls.
- Keep [`src/app/boot.ts`](src/app/boot.ts) small, synchronous, and CSP-compatible; it should not become a general runtime loader.
- Treat `public/boot.js` as ignored generated output; it is regenerated by `bun run dev`, `bun run build`, and `bun run util:check`.
- Viewport scrollbar chrome is intentionally hidden by default while native scrolling remains active; use `[data-native-scroll]` or `[data-scroll-native]` when visible native scrollbar affordance is needed.
- Validate public claims, structured data, social metadata, robots behavior, and feed content against project sources before launch.
- Avoid editing generated Cloudflare types by hand; regenerate with `bun run cf:types`.

## 9. Validation

- Required gate before completion: `bun run util:check`.
- Run `git diff --check` before commit.
- When production output changes, verify `bun run build` and inspect the relevant `dist/client` output.
- When first-paint theme, controls storage, router behavior, or headers change, add a focused browser smoke check for the affected path.
- When Cloudflare config or bindings change, run the relevant `cf:*` command and confirm `wrangler.d.ts` is current.
