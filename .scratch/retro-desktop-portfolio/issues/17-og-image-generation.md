# Research: build-time OG image generation in Astro 7

Type: research
Status: open
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
