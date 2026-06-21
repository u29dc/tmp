> `www-template` is a content-free Astro website architecture template with a custom TypeScript runtime for precise input, scroll, motion, route, theme, and UI behavior.

## 1. Documentation

- Canonical agent contract: [`AGENTS.md`](AGENTS.md)
- Compatibility mirrors: [`README.md`](README.md) and [`CLAUDE.md`](CLAUDE.md) symlink to `AGENTS.md`.
- Runtime entry: [`src/app/app.ts`](src/app/app.ts)
- Runtime loop: [`src/app/core/app.ts`](src/app/core/app.ts)
- Runtime settings: [`src/app/core/settings.ts`](src/app/core/settings.ts)
- Test fixture: [`src/pages/test.astro`](src/pages/test.astro)

## 2. Repository Structure

```text
.
├── src/app/            browser runtime modules and UI enhancements
├── src/layouts/        Astro document shell and SEO placeholders
├── src/pages/          blank homepage, robots, sitemap, and test fixture
├── src/styles/         shared CSS imports, tokens, and base styles
├── public/             static placeholder assets and headers
└── AGENTS.md           canonical repo-level agent instructions
```

- Keep real project content out of this template until brand, claims, and deployment are confirmed.
- Keep `.tmp/` as ignored research and reference material.
- Keep `README.md` and `CLAUDE.md` as symlinks to `AGENTS.md` for tool compatibility.

## 3. Stack

| Layer           | Choice                            | Notes                                              |
| --------------- | --------------------------------- | -------------------------------------------------- |
| Runtime         | Bun + Astro                       | static output with client-side runtime enhancement |
| Styling         | CSS tokens + Tailwind v4 plugin   | shared CSS tokens own the baseline system          |
| Browser runtime | Raw TypeScript under `src/app`    | no framework component state for core interaction  |
| Dev controls    | Tweakpane in `src/app/dev`        | development-only settings surface                  |
| Validation      | oxfmt, oxlint, Astro check, build | run through `bun run util:check`                   |

## 4. Commands

- `bun install` - install dependencies and hooks.
- `bun run dev` - run Astro dev server.
- `bun run update` - update packages using the Astro alpha lane inherited from `www`.
- `bun run util:format` - format supported source files with `oxfmt`.
- `bun run util:lint` - lint source with `oxlint`.
- `bun run util:types` - run Astro type diagnostics.
- `bun run util:check` - run the full local quality gate.

## 5. Architecture

- [`src/app/core/app.ts`](src/app/core/app.ts): owns the single visible `requestAnimationFrame` loop and module order.
- [`src/app/core/module.ts`](src/app/core/module.ts): defines explicit lifecycle hooks: `preInit`, `init`, `resize`, `update`, `dispose`.
- [`src/app/systems/scroll.ts`](src/app/systems/scroll.ts): native-backed smooth wheel enhancement, anchors, and `[data-scroll]` ranges.
- [`src/app/systems/motion.ts`](src/app/systems/motion.ts): small cancellable motion scheduler for route and future page choreography.
- [`src/app/systems/theme.ts`](src/app/systems/theme.ts): applies theme settings, CSS variables, `color-scheme`, and runtime theme metadata.
- [`src/app/ui/`](src/app/ui): data-attribute UI state for links and buttons.

## 6. Runtime and State

- Runtime behavior is wired through `data-*` attributes, not framework component state.
- `update` is the single public per-frame hook; modules should internally keep layout reads before DOM/style writes.
- Event handlers collect state and schedule work; they should not measure layout or write DOM state directly.
- The loop may stay active while the document is visible; optimize inactive modules by making them cheap.
- Native scroll is the fallback; smooth scrolling is an enhancement gated by settings, device, network, pointer, and motion profile.
- `src/app/dev/*` is development-only and must not become the source of production defaults.

## 7. Conventions

- Use the `@/*` alias for imports from `src`.
- Avoid parent-directory traversal like `../` for internal source imports when `@/*` is available.
- Keep CSS tokens in [`src/styles/tokens.css`](src/styles/tokens.css); runtime numeric settings belong in [`src/app/core/settings.ts`](src/app/core/settings.ts).
- Keep root page content blank or placeholder-only until this template is adapted for a real site.
- Use scoped Conventional Commits such as `feat(runtime): add scroll range state`.

## 8. Constraints

- Do not add real project copy, customer claims, certification claims, performance metrics, or private source material.
- Do not commit `node_modules`, `dist`, `.astro`, `.tmp`, reference clones, private source material, or environment files.
- Treat SEO metadata and social images as placeholders until a real deployment target exists.
- Keep Tweakpane and dev-only controls behind the `import.meta.env.DEV` path.

## 9. Validation

- Required gate before completion: `bun run util:check`.
- Run `git diff --check` before commit.
- When changing hooks or staged-file behavior, also run or rely on `lint-staged` through the pre-commit hook.
- If a change affects production output, verify `bun run build` and scan `dist` for unintended dev-only strings.
