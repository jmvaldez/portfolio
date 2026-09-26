# Map: Retro Desktop Portfolio

## Destination

A locked spec for Joe's software-engineering portfolio — visual system, interaction
model, site architecture, and content model — backed by throwaway prototypes of the
two risky bits (the WebGL scene, the window manager), ready to hand to `/plan` and
`/execute`. Shipping is a separate effort; this map ends when nothing is left to
decide.

## Notes

**Domain**: a personal portfolio site styled as a retro personal computer. The
aesthetic spine is the green-phosphor terminal (mono, scanlines, green-on-black).
Commodore-blue vector grid is the 3D backdrop only. Competitive-FPS HUD supplies
chrome (crosshairs, ammo-counter numerals, kill-feed-style toasts). Fallout supplies
the *voice* (Pip-Boy framing, dry in-world copy). One layer each — that discipline is
what keeps it from reading as a theme pack.

**Skills every session should consult**: `grilling` and `domain-modeling` by default;
`prototype` for prototype tickets; `research` for research tickets.

**Where things live**: tickets in `issues/NN-<slug>.md`; research write-ups in
`research/NN-<slug>.md`; prototypes on their own throwaway branch, linked from the
ticket. Research agents work on `research/<slug>` branches, merged to `main` on
resolution.

**Standing preferences**
- Break the build into small tasks; one PR per task. Clean and modular.
- Audience is both recruiters and peers; no rush, but legibility never loses to the toy.
- Content is lorem ipsum throughout. Real copy is a separate effort at the end.
- Plan, don't build: tickets here resolve decisions. The build happens after this map closes.

**Settled while charting** (constraints for every session, not route steps)
- **Shape**: hybrid. A desktop shell is the landing experience; long content lives on
  real, readable pages. Not a full OS simulation, not a retro-dressed scroller.
- **3D**: ambient Commodore-style vector grid as the floor, plus one orbitable
  low-poly/wireframe FPV drone inside a `viewer.exe` window. Desktop only; static
  fallback on mobile and under `prefers-reduced-motion`.
- **Terminal**: real and typeable, but a toy shell (`ls`, `cd`, `cat`, `whoami`,
  easter eggs) and always an alternate path, never the only navigation.
- **Boot**: short POST-style sequence, skippable by any keypress, once per session.
- **IA**: `about`, `projects` (+ per-project detail pages), `drones` (first-class,
  not folded into projects), `resume`, `contact`, plus a persistent taskbar.
- **Mobile**: a separate linear layout that keeps the desktop's chrome (title bars as
  section headers, scanlines, HUD accents) but drops the metaphor.
- **Stack**: new repo at `/mnt/shared/dev/portfolio`. Astro 7 + Tailwind 4, desktop
  shell as a React island with `@react-three/fiber`, content pages near-zero JS.
  (Astro 5 was named while charting and is stale: 7.0 shipped 2026-06-22. Nothing in
  the island model or the `client:*` directives changed between 5 and 7.)
- **Content**: Astro content collections — MDX + zod-validated frontmatter. The fake
  filesystem the terminal walks *is* the collection tree.
- **Hosting**: static Astro on Cloudflare Pages. Contact is `mailto:` in v1; no backend.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

- [Three.js / R3F inside Astro](issues/01-threejs-in-astro.md): `client:only="react"` on
  the shell island with the 3D scene behind a `React.lazy()` boundary and a `matchMedia`
  gate; 237 KB gzip for three+R3F+drei, content pages measured at 0 KB JS. Use `<Canvas>`,
  not the `createRoot` escape hatch. Teardown is already correct — minimise keeps the
  canvas mounted at `frameloop="never"`, only an explicit close unmounts.
- [Sourcing the drone model](issues/03-drone-model-sourcing.md): build it procedurally
  from three.js primitives — a recognisable FPV quad is ~388 triangles, ships zero asset
  bytes and zero licence obligations, and is the only route that guarantees the wireframe
  reading. No CC0 quadcopter exists anywhere in the free commons. Fallbacks, in order: a
  $5.99 Sketchfab Standard model, then a CC BY 3.0 poly.pizza quad.

## Not yet specified

- **Sound design.** Keyboard clicks, boot chime, window open/close. Hangs on how
  committed the overall treatment turns out to be.
- **Accessibility strategy beyond `prefers-reduced-motion`.** Keyboard navigation of
  a window manager, focus order, screen-reader story for a desktop metaphor, contrast
  under a CRT overlay.
- **Project case-study page template.** What a single project page actually contains
  and how deep it goes. Waits on the content model.
- **Resume delivery.** PDF download, a rendered page, or both.
- **Performance budget and how it's enforced** (Lighthouse CI, bundle-size gate).
- **SEO and social**: meta, OG images for a site whose landing is a canvas.
- **Domain name and analytics.**
- **Repo visibility, and what it implies for assets.** If the repo goes public, paid
  royalty-free licences (Sketchfab Standard, Quaternius QAL) forbid committing the asset
  file, while CC-BY permits it — an inversion where the paid route is the riskier one.
  Moot if the drone stays procedural; decide alongside hosting.
- **A `/credits` page.** Only needed if any CC-BY asset lands. CC BY 4.0 §3(a)(2) lets a
  hyperlink satisfy attribution, so it never has to intrude on the UI.

## Out of scope

- **Blog / writing section.** Ruled out of v1; the IA must accommodate adding one
  later without rework. An empty blog is worse than no blog.
- **Desktop-pet drone** (drone flying around the desktop reacting to the cursor).
  A v2 delight, not a v1 commitment.
- **3D as a place** (the whole desktop inside a navigable 3D room). Multi-week scope
  that makes the work harder to read.
- **Terminal as primary navigation.** Fails the 40-second recruiter test.
- **Real content.** Deliberately deferred; lorem ipsum until the build is done.
- **Draco mesh compression.** Its glTF decoder is 250 KB against an ~85 KB model, and
  drei's `useGLTF` silently defaults it to a gstatic.com CDN. Meshopt (29 KB) if any
  loader is ever needed at all; procedural means none is.

## Hazards

<!-- things a later session must not rediscover the hard way -->

- **Downloaded drone models must be looked at, not just licence-checked.** The post-2022
  free "FPV drone" corpus is overwhelmingly military — kamikaze drones, munitions,
  surveillance rigs — and one popular low-poly quad has Rostec branding baked into its
  textures. A recruiter-facing page rendering a loitering munition is hard to walk back.
- **`vite.ssr.noExternal: ['@react-three/drei']` breaks `astro dev`** with a 500 and a
  `detect-gpu` CJS named-export error. It is the obvious-looking fix for three's CJS
  deprecation warning and it is a trap; `client:only` avoids the warning instead.
- **`LineBasicMaterial.linewidth` is ignored by WebGL and WebGPU** — always one pixel. A
  1 px hairline dies under scanlines. Use drei's `<Edges>` (fat lines via `LineSegments2`).
