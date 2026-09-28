# Retro Desktop Portfolio

Joe Valdez's software-engineering portfolio, presented as a retro personal computer. The
landing experience is a desktop shell — `valdez-os` — with windows, a toy terminal, and
an ambient 3D scene; long-form content lives on real, readable pages outside the shell.
The site is currently a placeholder scaffold: `/` renders `valdez-os 1.0` and nothing
else has been built yet.

## Stack

- [Astro 7](https://astro.build) (static output), [React](https://react.dev) for the
  shell island
- [Tailwind CSS 4](https://tailwindcss.com)
- Deployed as a static site on Cloudflare Pages

## Usage

```bash
pnpm install
pnpm dev       # local dev server
pnpm verify    # lint, typecheck, unit tests, build, e2e — the full repo gate
```

`pnpm verify` needs Chromium once per machine: `pnpm exec playwright install chromium`.

## Deployment

The build runs in [GitHub Actions](.github/workflows/deploy.yml), not Cloudflare Pages' own
git-connected builds: `pnpm build` renders `dist/resume.pdf` from `/resume/` with a real
headless Chromium via Playwright, and Cloudflare Pages' build environment can't run one. The
workflow builds `dist/` and deploys it with `wrangler pages deploy` on every push to `main`
(and on manual dispatch), so Cloudflare only ever receives a finished static site.

It needs two repo secrets, `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, for the
Cloudflare Pages project `joe-valdez-portfolio`. Until they're set, the deploy step is
skipped with a `::notice::` and the workflow still passes.

## Design record

The design is specified in [`.scratch/retro-desktop-portfolio/map.md`](.scratch/retro-desktop-portfolio/map.md),
along with its resolved tickets and research write-ups in the same directory. That map
is the source of truth for terminology and settled decisions; `CONTEXT.md` is the
glossary derived from it.
