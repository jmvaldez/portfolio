# Research: build-time OG image generation in Astro 7

Type: research
Status: resolved
Blocked by: —

## Question

Every entry has a URL (ticket 12) and deserves its own OG image. The site is static Astro 7
on Cloudflare Pages with no backend, so images have to be rendered at build time. Find out:

- The current state of Satori + resvg (or successors) in an Astro 7 static build: a
  static endpoint per entry (`getStaticPaths` over the collections) versus an integration,
  and the maintained options.
- Font handling. Satori needs raw TTF/OTF, not woff2. Can the renamed Plex Mono subset
  from ticket 13 be fed to it, and does the OFL Reserved Font Name rule also apply to the
  generation-time copy?
- Whether Satori can render the chrome at all: bevelled frames, the dual phosphor palette,
  and a static scanline texture. Or is the CRT treatment a pre-rendered background PNG?
- Build-time cost per image, and whether it's cached across builds on Cloudflare Pages.
- Astro 7's head/meta story: any built-in SEO component, and how per-entry `<meta>` is
  normally driven from collection frontmatter.

Primary sources only. Carry the hazards forward in the Astro 7 vein: Sätteri, the Rust
compiler, Zod 4.

## Research

Findings: [build-time OG image generation in Astro 7](../research/17-og-image-generation.md).
In short: a static `getStaticPaths` endpoint rendering with Satori + resvg-js from a renamed
TTF subset, with Astro 7.2's experimental incremental build and Cloudflare Pages' build
cache keeping the images across deploys.

## Resolution

Generate OG images with a hand-written static endpoint, `src/pages/og/[...path].png.ts`, that
runs `getStaticPaths` over the collections and renders each image with Satori 0.33 and
`@resvg/resvg-js` 2.6. Satori draws the full chrome itself (bevel, bloom, scanlines, slashed
zero), so there's no pre-rendered background. The font is a TTF built by ticket 13's subsetting
script without `--flavor`, renamed like the woff2. Rendering costs about 0.3 s per image cold.
Astro 7.2's experimental `incrementalBuild` flag, with Cloudflare Pages' build cache turned on,
skips images that haven't changed. Astro 7 has no SEO component, so meta goes in a
hand-written `Head.astro`, with absolute URLs built from `site`. Takumi is the fallback if
resvg-js goes stale. The options weighed, the evidence, and 15 hazards are in the write-up.
