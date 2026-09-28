# Retro Desktop Portfolio

Joe Valdez's software-engineering portfolio, presented as a retro personal computer. The
landing experience is a desktop shell — `valdez-os` — with draggable windows, a toy
terminal, and an ambient 3D scene; long-form content lives on real, readable pages outside
the shell. The project, drone and page entries under `src/content/` are placeholders.

## What's where

- **`/`** server-renders the linear layout: the site as a stack of framed sections, which
  is what mobile visitors, visitors without JS, and crawlers get. Above the breakpoint (and
  without a layout override), a small head script hands off before first paint to the boot
  sequence, or the one-line restore, and then the desktop shell — a `client:only` React
  island in `src/shell/`.
- **The desktop shell** has a free-floating window manager with snap zones
  (`src/shell/wm/`), a taskbar and desktop icons, content and folder windows, a terminal
  that walks the filesystem (`src/shell/terminal/`), and a lazily loaded Three.js scene
  behind a capability gate (`src/shell/scene/`), with an SVG fallback.
- **Pages** (`src/pages/[...path].astro`) are one static route per filesystem node. They
  ship no external JavaScript. A window's maximise box promotes it to its page.
- **The filesystem** (`src/fs/`) is assembled at build time from the content collections
  by a mount table. `/fs/body/…` and `/fs/src/…` serve each entry's rendered body and raw
  source for the shell to fetch on demand.
- **`/resume/`** is the resume page. `pnpm build` renders it to `dist/resume.pdf`.
- **`/og/…png`** are per-page Open Graph cards, rendered at build time with Satori and
  resvg.

[`CONTEXT.md`](CONTEXT.md) defines the vocabulary used here (window, promotion, linear
layout, mount, and so on).

## Stack

- [Astro 7](https://astro.build) (static output), [React 19](https://react.dev) for the
  shell island, [Zustand](https://zustand.docs.pmnd.rs) for its state
- [Three.js](https://threejs.org) via React Three Fiber and drei for the scene
- [Tailwind CSS 4](https://tailwindcss.com)
- Satori + resvg for OG images; Playwright's Chromium for the resume PDF
- "Valdez Mono", a renamed IBM Plex Mono subset, self-hosted through Astro's Fonts API
- Deployed as a static site on Cloudflare Pages

## Usage

Needs Node 24+ and pnpm.

```bash
pnpm install
pnpm dev        # local dev server
pnpm verify     # lint, typecheck, unit tests, build, byte budgets, e2e — the full repo gate
```

`pnpm verify` needs Chromium once per machine: `pnpm exec playwright install chromium`.

Other scripts:

| Script              | Does                                                                            |
| ------------------- | ------------------------------------------------------------------------------- |
| `pnpm build`        | `astro build`, then renders `dist/resume.pdf`                                   |
| `pnpm build:site`   | `astro build` only, without the PDF                                             |
| `pnpm preview`      | serves `dist/` on port 4321                                                     |
| `pnpm test`         | Vitest unit tests                                                               |
| `pnpm test:e2e`     | Playwright e2e tests (`tests/e2e/`)                                             |
| `pnpm budgets`      | byte-budget check over `dist/` (run after a build)                              |
| `pnpm lighthouse`   | Lighthouse CI against `dist/`, mobile and desktop presets                       |
| `pnpm format`       | Prettier and `eslint --fix`                                                     |
| `pnpm fonts:subset` | regenerates the committed font files (needs Python `fonttools[woff]`, `brotli`) |

## Performance budgets

`scripts/check-budgets.mjs` holds the byte budgets, all gzip: no external JS and at most
1 KB of inline JS on content pages, 90 KB of initial island JS, 250 KB for the lazy scene
chunk, 20 KB of CSS, 60 KB of fonts, and 150 KB for the resume PDF. Lighthouse
(`lighthouserc.cjs`, `lighthouserc.desktop.cjs`) blocks on CLS and resource sizes. LCP and
TBT only warn, because they are too noisy on shared runners to gate on.

## CI and deployment

[`ci.yml`](.github/workflows/ci.yml) runs `pnpm verify` on every PR and push to `main`,
then a Lighthouse job against that same `dist/`. On PRs it posts the report links as a
comment.

The deploy build runs in [GitHub Actions](.github/workflows/deploy.yml), not in Cloudflare
Pages' own git-connected builds, because `pnpm build` renders the resume PDF with a real
headless Chromium, which Cloudflare's build environment can't run. The workflow builds
`dist/` and deploys it with `wrangler pages deploy` on every push to `main` (and on manual
dispatch), so Cloudflare only ever receives a finished static site. Both workflows cache
Astro's incremental build (`node_modules/.astro`) so the OG images aren't re-rendered on
every run.

The deploy needs two repo secrets, `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, for
the Cloudflare Pages project `joe-valdez-portfolio`. Until they're set, the deploy step is
skipped with a `::notice::` and the workflow still passes. `site` in `astro.config.mjs` is
still the `pages.dev` placeholder origin.

## Design record

The design is specified in [`.scratch/retro-desktop-portfolio/map.md`](.scratch/retro-desktop-portfolio/map.md),
with its resolved tickets and research write-ups in the same directory. That map is the
source of truth for settled decisions; `CONTEXT.md` is the glossary derived from it.
