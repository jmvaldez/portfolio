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
- **Content**: Astro content collections — zod-validated frontmatter. The fake
  filesystem the terminal walks *is* the collection tree. (MDX was named while charting
  and is stale; ticket 05 settled on plain `.md`.)
- **Hosting**: static Astro on Cloudflare Pages. Contact is `mailto:` in v1; no backend.
- **Repo is public.** The source is part of the portfolio. That's safe because the drone
  is procedural and the face is OFL (with the subset renamed, per ticket 13). No CC-BY
  asset lands, so no `/credits` page is needed. If one ever does, CC BY 4.0 §3(a)(2) lets
  a hyperlink satisfy attribution. A paid royalty-free asset must never be committed.

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
- [CRT / phosphor treatment](issues/02-crt-phosphor-treatment.md): hybrid — a CSS-only
  DOM overlay for the shell (scanline gradient + `text-shadow` bloom) plus a shader pass
  confined to the R3F canvas. Three refusals: no `mix-blend-mode` (6x compositor cost for
  pixel-identical output), no `filter` on a wrapper (it becomes a containing block for
  fixed/absolute descendants, which would break the window manager), no barrel distortion.
  Scanlines on shell chrome only, never over long-form body copy. Static, not animated.

- [Window manager: does it feel right?](issues/04-window-manager-prototype.md): free
  float with snap zones — edges and corners tile, 8px window-to-window magnetism,
  dragging a snapped window restores its pre-snap size. Hand-rolled, no library: all
  three prototype variants came to 423 lines of JS, against ~30 KB gzip for `react-rnd`
  that would also own the chrome's DOM. Seed layout is fractions of the canvas; window
  position is not persisted across reloads.

- [Content model and the fake filesystem](issues/05-content-model.md): plain `.md`, not
  MDX — `.mdx` entries never carry `entry.rendered`, `.md` do, which deletes the whole
  rendering mechanism. Three collections (`projects`, `drones`, `pages`), infinitely
  nestable, each schema a union discriminated on an explicit `type` so a nested note
  isn't forced to carry project frontmatter. A directory's content is `readme.md`, never
  `index.md`. A mount table assembles the tree and also feeds the taskbar launchers and
  the desktop icons. `cat` prints raw source; windows hold the full body, one static
  file per entry fetched on open and prefetched on hover.

- [Visual system](issues/06-visual-system.md): variant C, instrument panel, CRT on. Dual
  phosphor — green `#7dff8f` is data, amber `#ffc24d` is chrome and numerals. Heavy 3px
  bevelled frames, square corners, 30px title bars, gauges in the taskbar, the strongest
  CRT in the set (0.32 alpha on a 3px period). **Long-form body copy stays mono**, at
  15px / 1.75 / 58ch — no sans anywhere. Focus is an amber border plus a lit title bar.
  The DPR moiré call inherited from ticket 02 is **fixed, not accepted**: soft-edged
  scanline bands have no hard stop to snap to a device pixel, which removes the artefact
  at every DPR and deletes the `(resolution: Ndppx)` query from the design. The webfont
  itself is still open, graduated to [Typeface selection](issues/13-typeface.md).

- [WebGL scene composition](issues/07-webgl-scene-composition.md): variant B — **one
  canvas, drei `<View>`**. The grid tracks `#desktop`, each `viewer.exe` tracks its own
  window body; windows add views, never contexts (1 context with five viewers open, against
  A's 6), so the browser's context cap stops being a design constraint. Measured on a real
  GPU: all three variants are vsync-capped in the light case and only separate under stress
  (DPR 2, high density, five viewers), where B holds the best worst-frame (66.6ms vs A's
  109.3ms) and C collapses to 16 fps. The reported "post-process cannot compose with
  `View.Port`" was wrong — the pass brackets it at useFrame priorities 0.5 / 1 / 10, so
  ticket 02's hybrid CRT survives. `drag mode: freeze` is A-only: with a shared canvas it
  measured *worse* than live. The procedural ~388-triangle quad reads as an FPV drone.

- [Navigation and transition model](issues/09-navigation-and-transitions.md): **promotion is
  the navigation** — a window holds the full body and its maximise box navigates to the
  node's page; a window has a maximise box iff its node has a URL, so synthetic nodes are
  shell-only. The shell never mutates the URL (always `/`), so an in-window section is not
  linkable and the page is the one canonical address. The terminal never navigates. `/`
  server-renders the linear layout and the shell replaces it on hydration, so one artifact
  serves mobile, no-JS and the crawler. A page carries the chrome and drops the metaphor,
  with a close box that is a plain `<a href="/">`. The transition is **native
  cross-document view transitions, outbound only** — `<ClientRouter />` is excluded because
  persisting the shell requires emitting the island on every page, which would put 237 KB
  of three + R3F on every content page against ticket 01's measured 0 KB. Return is a plain
  cut; Firefox degrades to it anyway. `sessionStorage` restores the window layout within a
  tab (narrowing ticket 04, not reversing it); the CRT toggle is a `localStorage`
  preference readable by the pages; boot is gated on shell state, not route.

- [Terminal command surface](issues/08-terminal-command-surface.md): nine commands
  (`help ls cd pwd cat open clear whoami exit`), no flags, Unix-shaped errors with a dry
  second line; prompt `guest@valdez:<wd>$`. The terminal is `/bin/terminal.exe`, one
  instance, open-but-unfocused on first arrival, backtick toggles it Quake-style. Tab
  completion plus 100-line history in `sessionStorage`. `open` raises windows by node kind
  and is the only terminal-to-window sync — clicking never moves the working directory.
  Apps are `.exe`, commands extensionless. Easter eggs (`sudo`, `rm -rf /`, `arm`/`disarm`,
  `hack`, Konami → amber grid) are absent from `help`, discoverable via `ls /bin`.

- [Boot sequence](issues/10-boot-sequence.md): the boot **starts at first paint, not at
  hydration** — an inline head script (above the breakpoint, JS on) hides the linear
  layout and shows a static CSS-timed boot screen the island takes over. Floor 600 ms,
  ceiling 1.5 s, waits only on the island mounting and never on the 3D chunk; a 6 s hard
  timeout reveals the linear layout so nobody is trapped. Returning visitors get a one-line
  `RESUME · N WINDOWS RESTORED` held only while the shell mounts. Any key/click/tap jumps
  to the end and is swallowed. Six straight POST lines, four reporting real state, no joke.
  Hard cut to the desktop; independent of the terminal motd.

- [Mobile layout](issues/11-mobile-layout.md): designed as the **linear layout** for all
  three jobs. Breakpoint `(min-width: 1024px) and (min-height: 600px)`, size only, shared
  verbatim by the boot gate and the island, with a **live swap both ways** (widening shows
  Resume, never a boot). `/` is one long scroll: a masthead over a CSS grid floor, then one
  **Section** per root mount in mount-table order, in a single ~72ch centered column at every
  width. A Section's only control is a maximise box, which is a plain link and appears only
  where the node has a URL. There's a fixed bottom taskbar strip of anchor launchers plus the
  CRT toggle, and it is shared with content pages. The drone is a build-time SVG from the
  procedural geometry. No terminal.

- [Content page template](issues/12-content-page-template.md): the URL is the node path
  without its extension (`/projects/orbital-mesh/`), and every entry has one, notes included.
  The **page frame** is a centered ~72ch column and is the morph target. Top to bottom:
  masthead with close box, terminal-style breadcrumbs, **spec block** (amber keys, green
  values, empty fields omitted), cover, clean body, gallery (plain-link thumbnails), footage
  (poster links, no iframes), children listing, prev/next among siblings, taskbar strip.
  Folder pages use the same template: readme body if one exists, then the listing. A
  window adds only a one-line **spec strip** above its body.

- [Typeface selection](issues/13-typeface.md): **IBM Plex Mono**, one face everywhere.
  Its true italic beat Noto Sans Mono's real small caps, since emphasis is on every page
  and small caps only in the spec keys, which get an explicit uppercase fallback, never
  `font-variant-caps`. Regular, Bold and Italic are hinted woff2, pre-subset with
  `smcp,c2sc,zero,case,tnum` kept, ~50 KB. They are self-hosted through Astro's local
  provider with only Regular preloaded, and use `swap`. Astro's `optimizedFallbacks` is off
  in favour of hand-written size-adjusted Menlo / Consolas / DejaVu Sans Mono faces.
  Slashed zero goes on chrome and terminal only. OFL is safe in a public repo, but the
  "Plex" RFN means the subset files are renamed.

- [Research: build-time OG image generation in Astro 7](issues/17-og-image-generation.md):
  Satori + resvg-js in a hand-written static `getStaticPaths` endpoint. Satori draws the full
  chrome, so there's no background PNG. The font is a renamed TTF subset, because Satori
  rejects woff2. About 0.3 s per image cold, and cached across deploys by Astro 7.2's
  experimental `incrementalBuild` plus Cloudflare's build cache. There's no SEO component,
  so meta goes in a hand-written `Head.astro`.

- [Accessibility strategy](issues/14-accessibility.md): **hybrid**. The shell is keyboard
  operable for everything that reaches content: launch, focus, raise, minimise, close, read,
  promote. Geometry (move, resize, snap, orbit) is excluded. A first-Tab-stop "Skip to text
  layout" link sets a `localStorage` **layout override** the head gate honours, which makes
  the linear layout WCAG 2.2's *conforming alternate version* and carries the shell's
  2.5.7 / 2.1.4 gaps. Target is 2.2 AA. Forced colours and increased contrast only set the
  CRT toggle's default. Maximise is "Open <title> page". Canvases are `aria-hidden`, with a
  text line for the drone. Terminal output is a polite `role="log"`, one unit per command.
  Boot is `aria-hidden`, followed by one ready status. Z-order never reorders the DOM.

## Not yet specified

<!-- empty: the remaining fog graduated into tickets 14-19 on 2026-09-27 -->

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
- **Sound design** (key clicks, boot chime, window open/close). Everything settled is
  silent. Sound would bring autoplay-policy workarounds and a mandatory mute control. A v2
  delight, like the desktop pet.
- **Domain name.** Registering and pointing a domain is a shipping chore, not a spec
  decision. Analytics, which *does* touch the spec, is [Analytics](issues/16-analytics.md).

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
- **A CSS `filter` on a wrapper element becomes a containing block** for absolutely and
  fixed-positioned descendants. Wrapping the desktop in a filter to get CRT bloom would
  silently break window positioning. Per Filter Effects L1.
- **`mix-blend-mode` on a full-viewport overlay costs ~6x display-compositor work and
  changes no pixels** against a near-black ground — multiply against black reduces to
  plain source-over alpha. Measured: 2.3ms → 13.8ms per frame, of a 16.7ms budget.
- **`prefers-reduced-motion` is the wrong lever for a static overlay.** The right ones are
  `prefers-contrast: more` and `forced-colors: active`. And if any part of the CRT
  treatment animates, WCAG 2.2.2 makes a pause/stop/hide control a conformance
  requirement — a strong argument for keeping it static.
- **A fixed-pixel seed layout is a trap.** It looks composed on a laptop and like four
  stamps in the corner of a 4K screen. All initial window geometry is expressed as
  fractions of the canvas.
- **A window can end up entirely outside a shrinking desktop and be unreachable.** Pixel
  geometry does not follow the viewport. A rescue clamp on every viewport change, keeping
  each title bar reachable, is required — and is only a floor. Below the mobile
  breakpoint the desktop shell must not render at all.
- **Astro 7 replaced remark with Sätteri** as the default Markdown processor and
  `@astrojs/markdown-remark` is no longer installed. Plugin-free content is unaffected,
  but every remark snippet on the internet is now wrong for this codebase, and the
  standard reading-time recipe needs rewriting as a Sätteri mdast plugin. Unexplored.
- **`.mdx` entries never have `entry.rendered`; `.md` entries do.** `@astrojs/mdx`
  registers `contentModuleTypes`, which sends every `.mdx` entry down the deferred-render
  branch unconditionally. Anyone "upgrading" the content to MDX later silently loses
  `rendered.html` and has to reintroduce the Container API to get it back.
- **`getCollection()` from client code is a hard build error** (`[ServerOnlyModule]`),
  with no workaround. Anything the browser needs from a collection must be built at
  build time and serialised.
- **The glob loader strips a trailing `/index`**, so `x/index.md` and a sibling `x.md`
  produce the same id and one silently wins. Dodged by using `readme.md` for a
  directory's content; reintroducing `index.md` reopens it.
- **Zod 4 since Astro 6.** Import `z` from `astro/zod`, not `astro:content`.
  `.default()` must now match the *output* type, `z.string().email()` became `z.email()`,
  and `errorsMap` is gone.

- **Hard colour stops in a scanline gradient beat against fractional DPR.** At DPR 1.25
  and 1.5 Chrome snaps them to whole device pixels with no antialiasing, so the bands
  alternate between 1 and 2 device pixels and ripple. Soft-edged bands (a ramp, not a
  stop) have no edge to snap and fix it at every DPR without a `(resolution: Ndppx)`
  matrix. Anyone "tidying" the gradient back to two hard stops reintroduces it.
- **The soft-edge fix is unverified on real fractional-DPR hardware.** Reasoned and
  checked at DPR 1 only. Look at the shell on a 1.25x or 1.5x Windows display before
  trusting it.
- **A palette that passes AA unattenuated can still fail under its own scanline**, and
  the failure lands on the small subordinate text — bylines, column headers, gauge
  labels — which is exactly the text nobody re-checks. Every token gets its contrast
  computed against the scan-darkened surface, not the clean one.

- **An opaque DOM surface over the canvas is the silent failure mode of every
  shared-canvas design.** `#desktop` carried `background: var(--bg)` and paints after the
  full-viewport canvas, so the ambient grid was invisible in all three variants of the 07
  prototype, and the drone with it in B and C — for a whole session, convincingly enough to
  look like "only two contexts works". The ground fill belongs on an ancestor *behind* the
  canvas; `#desktop` and any window that shows 3D stay transparent. Whenever the 3D layer
  is blank, suspect paint order before suspecting WebGL.
- **drei's `View` leaves the viewport set to the last view it rendered.** `finishSkissor`
  restores `autoClear` and turns the scissor test off but does not reset the viewport, so a
  full-screen pass drawn afterwards appears squashed into whichever view went last — which
  reads exactly like proof that a post-process cannot compose with `View.Port`. Reset the
  viewport before the fullscreen quad.
- **Freeze-to-bitmap during drag only helps when something can stop rendering.** Under one
  shared canvas the grid must keep running, so a frozen window pays the full render *plus* a
  `toDataURL` of the whole canvas per gesture — measured worse than not freezing. The
  shared-canvas equivalent is `<View frames={0}>` / `visible={false}` on the dragged view.
- **`renderer.info` reports one renderer.** A design with a canvas per window (variant A)
  reports the stats of whichever renderer the HUD happens to hold — it read 2 draw calls
  against the one-canvas variants' 212. Frame timings stay sound; geometry counters do not.
- **The frame budget on integrated graphics is still unmeasured.** Every number in ticket 07
  is a discrete RTX 3060; two attempts to force headless Chrome onto this machine's AMD iGPU
  produced a page that loaded and never rendered. The DPR-2 / high-density stress column is a
  stand-in for a weak GPU, not a measurement of one.

- **`transition:persist` silently drops an element the next page does not contain.** Astro's
  shipped swap does `if (!newEl) continue;` and discards it with the old `<body>`; there is a
  test in Astro's own repo named for this case. The only way to persist the desktop shell
  across a navigation is to emit the island on *every* page — which means every content page
  runs 237 KB of three + R3F, against ticket 01's measured 0 KB. This looks like the obvious
  way to keep the desktop alive and it is a trap.
- **`<ClientRouter />` silently sets `prefetchAll: true`** for every link on the page
  (`init({ prefetchAll: true })` in the shipped source). Installing the router quietly
  overwrites any selective prefetch policy. `@astrojs/prefetch` is separately deprecated on
  npm.
- **Astro's router owns `history.state`** (`{index, scrollX, scrollY}`) and `onPopState`
  early-returns on `ev.state === null`, so an island calling `pushState(null, ...)`
  desynchronises Back — the URL changes and the DOM does not. **Still unfixed in 7.3.5.**
  Dodged here only because ticket 09 decided the shell never touches the URL. Also:
  `samePage()` compares pathname *and search*, so a query-string change makes the router
  fetch and swap the whole document on traversal, while a hash-only change short-circuits.
- **In `astro dev` only, an incoming `client:only` island is fully hydrated in a hidden
  `<iframe src=target>`** (`prepareForClientOnlyComponents()`). Every dev-mode client-side
  navigation back to the shell page therefore briefly runs **two shells and two WebGL
  contexts**. Production builds do not. Anyone profiling the shell in dev will measure a
  phantom.
- **Two elements sharing a `view-transition-name` skip the entire transition, silently.**
  The name must be applied to exactly the window being promoted, in the click handler, never
  statically to every window. Related: a named element forms a stacking context and
  **flattens 3D transforms at all times**, not only while transitioning, and a fragmented
  element drops out of the transition with no error.
- **Cross-document view transitions have no reduced-motion handling of their own.** Astro's
  router ships `animation: none !important` under `prefers-reduced-motion`; the CSS
  `@view-transition` form ships nothing, and reduced motion appears nowhere in either spec,
  on MDN, or in Chrome's docs. `navigation: none` inside `@media` is legal and is on us.
- **Firefox has no cross-document view-transition support** and its meta bug (1860854) has
  no target milestone. Note the inversion against Astro-5-era advice: *same-document* view
  transitions *did* land in Firefox 144, so Astro's router animates in Firefox while
  `@view-transition` does not.
- **Astro 7's Rust compiler no longer auto-corrects invalid nesting and errors on unclosed
  tags.** Hand-built window chrome is exactly the code that used to get away with it. Also
  `compressHTML: 'jsx'` strips whitespace between inline elements, and `src/fetch.ts` is
  now reserved.
- **A zero-JS page cannot read a `localStorage` preference.** The CRT toggle has to apply on
  content pages before first paint, which needs a small inline blocking script — the
  dark-mode pattern. "Near-zero JS" on content pages means this and nothing more; anyone who
  removes it to hit a literal zero will make the toggle appear not to persist.

- **Font subsetting strips the features the design depends on.** pyftsubset's defaults
  drop `smcp`, `c2sc` and `zero`, and Fontsource and Google-served woff2 files strip
  those and box drawing too. Always subset with
  `--layout-features+=smcp,c2sc,zero,case,tnum`, and check the output with fontTools.
- **Astro's Fonts API does not subset local files, and its `monospace` fallback is Courier
  New only**, placed *ahead* of any fallbacks you list. Leaving `optimizedFallbacks` on
  quietly shadows the hand-written Menlo/Consolas faces. Consolas without `size-adjust`
  narrows the 58ch column by ~44 px on swap.
- **"Plex" is an OFL Reserved Font Name.** A subset is a Modified Version, so shipping a
  subset still named "IBM Plex Mono" breaches the licence. Rename it inside the file, and
  commit `OFL.txt` beside the woff2.
- **`font-variant-caps: small-caps` on a face without `smcp` makes the browser fake it**
  with scaled capitals. Plex has none, so small caps are always the explicit uppercase
  fallback.
- **The fallback metrics are partly unverified.** The Menlo and Consolas advances came from
  secondary sources, and hinted Plex at 11–13px is unchecked on Windows at fractional DPR.
  Check both on real machines before trusting the numbers.

- **Satori rejects woff2 and drops missing glyphs silently.** Every OG render needs a TTF
  subset, renamed per the OFL, and any character outside the subset disappears with no
  warning.
- **Without `site` in the Astro config, `og:image` silently becomes
  `http://localhost:4321/...`** and the build still passes.
- **Astro's incremental build is blind to files read from disk, and turns off at
  `build.concurrency > 1`.** Hash the font into `cacheKey` by hand. Cloudflare Pages keeps
  only `node_modules/.astro`, its build cache is off until enabled, and it's purged after 7
  days without a read.
- **resvg-js scans system fonts on every render by default** (~75 ms per image). Pass
  `font: { loadSystemFonts: false }`.

- **Raising a window by moving its DOM node drops focus and reshuffles the tab order** under
  a keyboard user mid-gesture. Z-order is `z-index` only, and windows stay in open order in
  the DOM.
- **The shell's WCAG gaps are carried by the conforming-alternate-version clause, not
  fixed.** Drag-only geometry fails 2.5.7 and the global backtick fails 2.1.4 on their own.
  Remove or bury the "Skip to text layout" link, or let the head gate ignore the layout
  override, and `/` stops conforming.
- **Moving focus on boot completion strands screen-reader users past the skip link.** The
  ready state is announced through a status region and focus stays put.
