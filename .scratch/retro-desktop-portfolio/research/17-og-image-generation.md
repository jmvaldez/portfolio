# Research: build-time OG image generation in Astro 7

Informs ticket `.scratch/retro-desktop-portfolio/issues/17-og-image-generation.md`.
Date: 2026-09-27.

Package facts were read from the npm registry and the published tarballs of `astro@7.3.5`,
`satori@0.33.5`, `@resvg/resvg-js@2.6.2`, `astro-og-canvas@0.13.2`,
`astro-opengraph-images@1.20.3` and `@takumi-rs/core@2.14.0`. Docs came from
withastro/docs `main`, docs.astro.build, developers.cloudflare.com and openfontlicense.org.
Every behavioural claim marked **measured** was run in a scratch Astro 7.3.5 static project
outside the repo, with a content collection, a `getStaticPaths` endpoint, and a Plex Mono
subset renamed the way ticket 13 prescribes. It ran on Node 24.14 and a Ryzen 9 5900HX.
Cloudflare's build machines were not measured.

## Answer

**Use a hand-written static endpoint, `src/pages/og/[...path].png.ts`, that runs
`getStaticPaths` over the collections and renders with Satori 0.33 and
`@resvg/resvg-js` 2.6. Turn on Astro 7.2's `experimental.incrementalBuild` and return a
`cacheKey` per image, and enable the Cloudflare Pages build cache.** Satori renders the
chrome itself: the bevel, both phosphors, the bloom and static scanlines. No pre-rendered
background PNG is needed. Astro caches the images in `node_modules/.astro/`, which is
exactly the directory Cloudflare Pages persists for Astro, so an unchanged entry costs a
file copy on the next deploy.

The font is a **TTF** made by ticket 13's own subsetting script, with `--flavor` dropped
and the same rename, because Satori rejects woff2. The TTF sits in a public repo, so it is
distributed and the "Plex" Reserved Font Name rule applies to it just as it does to the
woff2. The rendered PNGs are not font software, so the OFL does not reach them.

Astro 7 has **no built-in SEO or head component**. The documented pattern is a
hand-written `Head.astro` in a layout, with URLs made absolute against `site`.

## Options

| Option | What it is | Verdict |
|---|---|---|
| **Static endpoint + Satori + resvg-js** | A `.png.ts` route, `getStaticPaths` over `projects` and `drones`, returns `new Response(png)` | **Recommended.** Measured working in Astro 7.3.5; works with the incremental build cache |
| Static endpoint + **Takumi** (`@takumi-rs/core` 2.14) | A Rust renderer taking its own node tree (or JSX/HTML via `@takumi-rs/helpers`) | Strong runner-up; see below |
| `astro-og-canvas` 0.13.2 | CanvasKit-WASM, `OGImageRoute` helper, fixed template | Rejected |
| `astro-opengraph-images` 1.20.3 | An `astro:build:done` integration: jsdom parses the built HTML, then Satori renders | Rejected |
| `@vercel/og` 1.0.3 | Satori plus `@resvg/resvg-wasm` 2.4.1 pinned, `ImageResponse` wrapper, Node ≥ 22 | Rejected: an edge-runtime wrapper around the same Satori, with an older resvg and nothing gained for a static build |
| Pre-rendered CRT background PNG under the text | A static image plus text drawn on top | Not needed: Satori draws the scanlines itself (measured). Keep it only as a fallback if a later design wants texture Satori can't express |

### Why not the others

- **astro-og-canvas.** The template is fixed. You get `title`, `description`, `logo`,
  `bgGradient`/`bgImage`, one `border` on a **single edge**, `padding` and font options
  (`dist/types.d.ts`). A title bar with a close box, a four-sided bevel and a spec line
  cannot be expressed, only faked in a background image. Its cache defaults to
  `./node_modules/.astro-og-canvas` (`generateOpenGraphImage.js:62`), which Cloudflare
  Pages does **not** persist. Its default font is fetched from `api.fontsource.org` at
  build time, and Fontsource files strip box drawing and `zero` (ticket 13, hazard 3).
- **astro-opengraph-images.** Its licence is **GPL-3.0-only**. It pins `react: 19.3.0` and
  pulls in `jsdom` and `tw-to-css`. It runs in `astro:build:done` and re-parses every built
  HTML page with jsdom (`src/integration.ts`, `src/hook.ts`), so it sits outside Astro's
  incremental cache and re-renders every image on every build. Its input is the rendered
  HTML's meta tags, not collection frontmatter.
- **Takumi.** It is real and fast (**measured**): it accepts the renamed **woff2 directly**,
  and a bloom text card took 21.5 ms against Satori+resvg's ~75 ms. It is MIT/Apache and
  has prebuilt native binaries. It loses on churn: 1.0 shipped 2026-04-10 and 2.0 shipped
  2026-07-08, two majors in three months (npm `time`). Its node format is its own, not
  Satori's de facto JSX-and-inline-style dialect. The bevel and scanline CSS was **not**
  tested in Takumi. Speed doesn't decide it at portfolio scale once the incremental cache
  exists. Revisit if the image count or the build time ever matters.

## The endpoint (measured)

```ts
// src/pages/og/[...path].png.ts: shape only
export const getStaticPaths = (async () => {
  const entries = [...await getCollection('projects'), ...await getCollection('drones')];
  return entries.map((e) => {
    const props = { /* title, summary, spec-strip text, filename */ };
    return {
      params: { path: nodePath(e) },          // ticket 12's node path, readme stripped
      props,
      cacheKey: sha256(FONT_HASH + JSON.stringify(props)),
    };
  });
}) satisfies GetStaticPaths;
export const GET: APIRoute = async ({ props }) =>
  new Response(await renderOg(props), { headers: { 'Content-Type': 'image/png' } });
```

- It emits `/og/projects/orbital-mesh.png`, `/og/projects/orbital-mesh/notes.png` and
  `/og/drones/nazgul.png` from one route. A rest param handles nested node paths.
- It builds the Satori tree as plain `{ type, props: { style, children } }` objects in a
  `.ts` file, so no React integration or JSX runtime is needed. Astro's `.astro` templates
  are not React elements, so Satori cannot render a `.astro` component.
- It reads fonts with `readFile(join(process.cwd(), …))`. **Measured:** at build time,
  `import.meta.url` is `dist/.prerender/chunks/<name>.mjs`, so a path made relative to the
  source file resolves into `dist/` and misses.
- It feeds Satori frontmatter strings, never `entry.rendered.html`. Astro 7's Markdown
  pipeline is Sätteri, and Satori has no HTML parser. `satori-html`, the usual bridge, was
  last published in 2022.

## Font handling

- **Satori accepts TTF, OTF and WOFF, not WOFF2.** Its README ("Fonts") says so, and the
  source converts WOFF to sfnt with `fflate` before handing it to HarfBuzz
  (`src/font.ts:78-122`). **Measured:** the ticket 13 woff2 throws
  `Unsupported OpenType signature wOF2`.
- **The npm `@ibm/plex-mono@2.5.0` package ships no TTF**, only `woff` and `woff2`. The TTF
  has to come from the subsetting script. **Measured:** the same pyftsubset call as ticket
  13 (same unicodes and `--layout-features+=smcp,c2sc,zero,case,tnum`), without `--flavor`
  and with the name table rewritten, gives Regular **57.3 KB** and Bold **57.7 KB** TTFs
  with no "Plex" left in the `name` table. Reading woff2 input needs the `brotli` Python
  module.
- **Satori ignores the internal family name.** The family is whatever `name` you pass in
  `fonts: [{ name, data, weight, style }]`, so the rename costs nothing here.
- **OpenType features work.** Since 0.33, Satori shapes text with HarfBuzz and honours
  `fontFeatureSettings`. **Measured:** `"zero" 1` gives Plex's slashed zero on the subset,
  so chrome and terminal text can match ticket 13's zero rule. Box drawing (`─┼─`) and
  block elements (`▓▒░`) render from the subset.
- **Licence.** The OFL FAQ says a subset is a Modified Version (Q2.6). A public commit or
  branch is redistribution of modifications, so a modified font cannot keep the RFN
  (Q3.8). The generation-time TTF is therefore bound by the same rename as the woff2.
  Output made with the font stays the author's and is not under the OFL (Q1.1.1), so the
  PNGs carry no licence obligation. The `OFL.txt` already next to the woff2 covers the TTF
  if it lives in the same folder.
- Keep the TTF out of `public/`. Nothing on the site needs it at runtime, and anything in
  `public/` is deployed.

## Can Satori render the chrome? Yes (measured)

A 1200×630 card rendered from the renamed TTF included the following:

| Chrome element | How, in Satori | Result |
|---|---|---|
| Bevelled frame | Per-side `borderTopColor`/`borderLeftColor` light, bottom/right dark. `borderStyle` supports only `solid` and `dashed`, with no `outset`/`inset`/`ridge` (README table) | Correct |
| Amber title bar + `[×]` | A flex row, `justifyContent: space-between` | Correct |
| Green bloom | `textShadow: '0 0 6px #33ff66, 0 0 14px #33ff6688'` | Correct, but it is the main cost (below) |
| Outer glow | `boxShadow` | Correct |
| Static scanlines | An absolute overlay painted **last**, with `repeating-linear-gradient(0deg, rgba(0,0,0,.28) 0 2px, transparent 2px 4px)` | Correct. SVG has no z-index, so paint order is document order |
| Slashed zero | `fontFeatureSettings: '"zero" 1'` | Correct |

Satori limits to design around (README "Note"): no 3D transforms, no z-index, no `calc`,
and `currentColor` works only on `color`. CSS custom properties **are** supported, so the
phosphor tokens can be passed in as variables.

## Cost per image (measured)

| Card | Satori | resvg → PNG | PNG size |
|---|---|---|---|
| Text-only, no bloom | ~3 ms | **17.5 ms** | — |
| Text-only, two-layer bloom | ~3 ms | **71.6 ms** | 112 KB |
| Same, plus scanline overlay | ~3 ms | 81–86 ms | 109 KB |
| Full chrome (bevel, title bar, bloom on 3 blocks, box-shadow glow, scanlines), inside `astro build` | 10–50 ms | **240–350 ms** | 112–158 KB |
| Takumi, text card with bloom | — | 21.5 ms total | 102 KB |

- Blur dominates: bloom quadruples raster time, and the full-frame `boxShadow` glow costs
  more again. At ~0.3 s per image, 50 entries take ~15 s on a cold build on this machine.
  That is acceptable, and it is why the cache matters.
- **`loadSystemFonts: false` matters.** resvg-js scans the system fonts on every `new
  Resvg()` by default. Here, with 721 system fonts, that added ~70-80 ms per image
  (88 ms vs 17.5 ms on the no-bloom card). Satori has already turned text into paths, so
  resvg needs no fonts at all.
- 100 bloom cards in sequence took 7.5 s.

## Caching across builds on Cloudflare Pages (measured + docs)

- **Astro 7.2+ `experimental.incrementalBuild`** skips any `getStaticPaths` path whose
  `cacheKey` and route dependency-graph hash both match the previous build, and copies the
  old output instead (`dist/types/public/config.d.ts:3389-3430`,
  `dist/core/build/incremental.js`; docs page
  `reference/experimental-flags/incremental-build/`). The cache lives in `cacheDir`, which
  defaults to `node_modules/.astro/` (`incremental-build.json` plus copies under `dist/`).
- **It works for endpoints, not only pages.** **Measured:** on the second build all three
  PNGs logged `(restored)`. Editing one entry's title re-rendered only that image. Editing
  `render.ts` re-rendered all of them, because it is in the module graph. `astro build
  --force` re-rendered everything.
- **Cloudflare Pages build caching persists `node_modules/.astro` for Astro.** It also
  persists `.npm` or `.pnpm-store`, but not `node_modules` itself. It needs the V2 build
  system or later and has to be enabled under Settings → Build → Build cache. The cache is
  purged 7 days after its last read, with 10 GB per project. The Astro docs say: "`cacheDir`
  must be restored before running `astro build`". On Pages that is automatic.
- What invalidates the whole cache (docs + `config-hash/input.d.ts`): the Astro config,
  including `site`, and the lockfile. Anything the dependency graph cannot see must go into
  `cacheKey` by hand, which means **font files and any image read with `fs`**.

## Head and meta in Astro 7

- `astro/components` ships `ClientRouter`, `Code`, `Debug`, `Font`, `Image`, `Picture`,
  `ResponsiveImage` and `ResponsivePicture`. It has **no SEO or head component**. The docs
  (`guides/configuring-astro.mdx`) show a hand-written `Head.astro` with `og:*` tags,
  included from a layout.
- Per-entry meta is driven the normal way: the `[...path].astro` page already has the
  entry, so the layout takes `title`, `summary` and the OG URL as props. The OG URL is the
  same node path the endpoint uses, so both come from one helper.
- Build the absolute URL with `new URL(path, Astro.site)` (API reference `Astro.site` /
  `Astro.url`). `site` must be set; see the hazards.
- Third-party head components exist (`astro-seo` 1.2.0 and others). None are needed for a
  handful of tags, and ticket 18 owns that choice.

## Hazards

1. **Satori rejects woff2.** The error is `Unsupported OpenType signature wOF2`. The
   ticket 13 woff2 cannot be reused, so emit a TTF (or WOFF) from the same subsetting
   script.
2. **The generation-time TTF is a Modified Version in a public repo.** OFL Q2.6 and Q3.8
   apply, so it gets the same "Plex" rename as the woff2. Do not commit an un-renamed
   subset "because it's only used at build time".
3. **Glyphs outside the subset vanish silently.** **Measured:** `Ω→✓` rendered as nothing,
   with no warning and no tofu. A real title containing `→`, `✓` or a non-Latin-1 letter
   will lose characters in the OG image. Either keep titles inside the subset ranges,
   check at build time, or pass Satori a `loadAdditionalAsset` fallback.
4. **Font files are invisible to the incremental cache.** The per-route hash covers module
   source only. A re-subset TTF, or a background PNG read with `fs`, will **not**
   invalidate cached images unless its hash is folded into `cacheKey`. The scratch
   endpoint does this with `FONT_HASH`.
5. **`build.concurrency > 1` silently disables the incremental cache** (docs). Do not try
   to speed up OG rendering that way.
6. **Cloudflare only persists `node_modules/.astro`.** A library cache anywhere else, such
   as astro-og-canvas's `node_modules/.astro-og-canvas`, is cold on every deploy. Build
   caching is also off until enabled in the dashboard, and a cache unread for 7 days is
   purged.
7. **Missing `site` gives a localhost `og:image`, silently.** **Measured:** without `site`,
   `new URL(p, Astro.url)` built to `http://localhost:4321/og/…` and `Astro.site` was
   `undefined`. The build passes and every share card breaks.
8. **`import.meta.url` points into `dist/.prerender/chunks/` at build time.** Read fonts
   relative to `process.cwd()` (the project root), or the read fails once bundled.
9. **resvg-js loads system fonts by default**, ~70-80 ms per image here. Pass
   `font: { loadSystemFonts: false }`. It also makes output independent of the build
   machine's fonts.
10. **Satori throws on a style key set to `undefined`** (measured, "Invalid value for CSS
    property"). Build style objects by omission (spread or delete), not `key: undefined`.
11. **Satori has no z-index, `calc`, 3D transforms or `inset`/`outset` borders.** Paint
    order is document order, so the scanline overlay must be the last child. Bevels are
    per-side border colours. Whitespace collapses as in CSS `white-space: normal`
    (measured: a double space became one), so aligned terminal-style text needs
    `whiteSpace: 'pre'`.
12. **Don't feed Satori rendered Markdown.** Astro 7's Sätteri output is HTML, and Satori
    takes element objects. Use frontmatter fields. `satori-html` has had no release
    since 2022.
13. **Zod 4 defaults land in `entry.data`.** Hash the post-parse props you actually render,
    not the raw frontmatter and not `entry.digest`. The digest also changes on body edits,
    which would re-render OG images for prose changes they don't show.
14. **resvg-js stable is old.** 2.6.2 dates from 2024-03-26, and 2.7.0 has been alpha
    since January 2026. It works on Node 24 today. If a Node upgrade ever breaks its
    native binary, `@resvg/resvg-wasm` (same version) or Takumi is the escape hatch.
15. **Blur is the cost.** Bloom plus a full-frame `boxShadow` took the full-chrome card
    from ~20 ms to ~300 ms of raster time. If cold builds get slow, cut the glow before
    anything else.

## Open questions

- Build time on Cloudflare's build image is unmeasured. Every number here is a Ryzen 9
  5900HX.
- Whether Cloudflare's restored `node_modules/.astro` actually yields `(restored)` in a
  real Pages deploy. The mechanism is documented and was measured locally, but no Pages
  deploy was run.
- `experimental.incrementalBuild` is experimental. Its flag or `cacheKey` API may change
  in a minor release; without it, generation is still correct, just uncached.
- Takumi's support for the bevel and the `repeating-linear-gradient` scanlines was not
  tested.

## Sources

- Satori README and `src/font.ts` (sourcemap in the `satori@0.33.5` tarball);
  github.com/vercel/satori.
- `astro@7.3.5`: `dist/core/build/incremental.js`, `dist/core/build/generate.js:365-450`,
  `dist/core/build/config-hash/input.d.ts`, `dist/types/public/config.d.ts:3389-3430`,
  `components/`.
- docs.astro.build/en/reference/experimental-flags/incremental-build/
- withastro/docs `src/content/docs/en/guides/configuring-astro.mdx` (Head.astro, og tags)
  and `reference/api-reference.mdx` (`Astro.site`, `Astro.url`).
- developers.cloudflare.com/pages/configuration/build-caching/
- openfontlicense.org/ofl-faq/ (Q1.1.1, Q2.6, Q3.8).
- `astro-og-canvas@0.13.2` `dist/types.d.ts` and `dist/generateOpenGraphImage.js`;
  `astro-opengraph-images@1.20.3` `src/integration.ts` and `src/hook.ts`;
  `@takumi-rs/core@2.14.0` README and `index.d.ts`; npm registry `time` and `license`
  fields.
