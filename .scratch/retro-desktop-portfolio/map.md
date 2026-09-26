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
- **Stack**: new repo at `/mnt/shared/dev/portfolio`. Astro 5 + Tailwind 4, desktop
  shell as a React island with `@react-three/fiber`, content pages near-zero JS.
- **Content**: Astro content collections — MDX + zod-validated frontmatter. The fake
  filesystem the terminal walks *is* the collection tree.
- **Hosting**: static Astro on Cloudflare Pages. Contact is `mailto:` in v1; no backend.

## Decisions so far

<!-- one line per closed ticket: gist + link -->

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

## Out of scope

- **Blog / writing section.** Ruled out of v1; the IA must accommodate adding one
  later without rework. An empty blog is worse than no blog.
- **Desktop-pet drone** (drone flying around the desktop reacting to the cursor).
  A v2 delight, not a v1 commitment.
- **3D as a place** (the whole desktop inside a navigable 3D room). Multi-week scope
  that makes the work harder to read.
- **Terminal as primary navigation.** Fails the 40-second recruiter test.
- **Real content.** Deliberately deferred; lorem ipsum until the build is done.
