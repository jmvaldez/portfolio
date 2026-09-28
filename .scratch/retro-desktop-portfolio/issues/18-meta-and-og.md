# Per-entry meta and OG images

Type: grilling
Status: resolved
Blocked by: 17

## Question

Decide the SEO and social layer on top of ticket 12's URL scheme:

- Which meta each page carries (title pattern, description source, canonical, and whether
  the shell's always-`/` URL needs anything beyond the linear layout the crawler already
  reads), and which frontmatter fields drive them. That may mean adding fields to ticket
  05's schemas.
- What an OG image looks like: one template per collection or one for everything, what it
  shows (title, spec-block fields, the drone SVG from ticket 11), and whether it carries the
  CRT treatment.
- The generation approach, chosen from ticket 17's findings.
- Whether synthetic and note nodes get OG images or fall back to a site default.
- Sitemap and robots.

## Answer

The captain delegated this ticket ("plan the rest using sensible defaults"). Every call
below is the agent's default. It builds on the OG image research
([build-time OG image generation](17-og-image-generation.md)).

### Meta, from a hand-written `Head.astro`

- **`site` is set in the Astro config** and every absolute URL is built from it. A missing
  `site` silently ships `localhost` OG URLs, so the build **fails** if it's unset.
- **`trailingSlash: 'always'`**, matching ticket 12's `/projects/orbital-mesh/`, so each
  page has exactly one spelling.
- **Title:** `<entry title> · Joe Valdez`. `/` is `Joe Valdez · Software Engineer`. It uses
  the human title, never the filename. `orbital-mesh.md` is for the terminal, not the tab.
- **Description:** the entry's `summary`. Where there's none (notes, pages without one, folder
  pages without a readme), it falls back to the parent's summary, then to one site-wide
  description. **No new schema fields.** `summary` already exists everywhere it matters, and
  fields named `seoTitle`/`ogImage` only get filled in inconsistently.
- **Canonical:** every page is self-canonical. The shell never changes the URL (ticket 09)
  and `/` server-renders the linear layout, so the crawler already reads the right document
  at the right address. The shell needs nothing extra.
- **Social:** `og:title`, `og:description`, `og:url`, `og:image` (1200×630, with
  `og:image:alt` set to the title), `og:type` `website`, `twitter:card`
  `summary_large_image`.
- **Structured data:** one `Person` JSON-LD block on `/` only (name, job title, `sameAs`
  links), rendered with `set:html`, never as a script that runs. Nothing per entry.
  `CreativeWork` markup gets no rich result for a portfolio.

### OG images: one template, every URL

**One template for everything**, drawn by Satori with the full chrome per ticket 17. It
shows a title bar carrying the node's **path** (`~/projects/orbital-mesh`), the title large
in phosphor green, and up to three spec fields in amber keys and green values chosen per
entry type. For a project that's `role`, the first three `tech`, and `period`. For a drone
build it's `class`, `frame` and `propSizeIn`. Pages and notes show the summary instead. The
CRT treatment is on but at half the shell's scanline strength, because a 1200px image gets
downscaled to thumbnails where full-strength scanlines turn into mud.

- **The drone wireframe (ticket 11's build-time SVG) appears only on the site default
  image**, used by `/` and any fallback. A drone on every project card would be the
  theme-pack failure the map's Notes warn against.
- **Every URL gets its own image**, notes and folder pages included. At about 0.3 s cold
  and cached, per-entry images are cheaper than the rule deciding who gets one. Synthetic
  nodes have no URL, so they have no image and no question.
- Images live at `/og/<node path>.png` from the endpoint ticket 17 specified.

### Sitemap and robots

- `@astrojs/sitemap`, over every page. `/og/` images and `/resume.pdf` aren't pages and
  aren't listed.
- `robots.txt`: allow everything and point to the sitemap. No crawler blocks. The site
  exists to be found.
- **No `noindex` anywhere.** There are no drafts (ticket 05), so nothing needs hiding.
