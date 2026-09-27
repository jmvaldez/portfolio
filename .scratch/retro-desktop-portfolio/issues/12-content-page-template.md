# Content page template

Type: grilling
Status: resolved
Blocked by: —

## Question

Decide what a real content page contains, now that the content model is settled and the
window is no longer a preview of it.

A project's body renders in two shells: a window inside the desktop, and a page at its
own URL. The content is identical by decision; the *framing* is not. Settle what the
page carries that the window does not — masthead, breadcrumbs back into the tree, the
frontmatter rendered as a spec block, `gallery` and `footage` layout, prev/next between
siblings, a way back into the desktop shell — and settle the inverse: what the window
carries that the page does not.

Also settle the folder page: a directory has a folder *window* showing a listing, so
what does the same directory look like at its own URL?

Constraints already binding: no scanlines over long-form body copy (ticket 02), and
long content must stay readable for a recruiter who never touches the desktop shell.

## Hard constraints from ticket 09

**The page's outer frame is a view-transition morph target.** Promotion animates the
window frame into the page frame via native cross-document view transitions, and the
differently-sized interpolation is the default group animation — so the page's outermost
framed element must carry the matching `view-transition-name` and must be shaped so that
morphing a window frame into it reads as the same object growing. A named element forms a
stacking context and flattens 3D transforms at all times, not only during the transition.

**The page carries the chrome and drops the metaphor.** Bevelled frames, amber and green,
mono, title-bar masthead, taskbar strip; no dragging, no snapping, no desktop surface.
Full CRT treatment on the chrome, body-copy area clean. Same rule as the mobile linear
layout, so the two surfaces stay one product.

**The masthead carries a close box** on its right: a plain `<a href="/">`, not
`history.back()`. It must work with zero JS and must behave identically for a deep-linked
visitor with no history.

**The page never auto-boots the shell.**

**The CRT toggle must work on the page**, reading the `localStorage` preference the shell
writes — so the page needs whatever minimal inline mechanism applies it before first
paint, without importing the island.

**The window/page split is settled, so this ticket is only about framing.** Both surfaces
carry the identical full body (ticket 05). What the page adds is everything a window
cannot hold: masthead, breadcrumbs, the frontmatter spec block, `gallery`/`footage`
layout, prev/next between siblings. A body taller than its window shows a persistent amber
`READ FULL PAGE` bar in the window — the invitation to promote lives on the window side,
so this ticket does not owe it one.

**Folder pages are in scope and reached the same way**: folder windows promote too, same
gesture, same meaning.

## Hard constraints from ticket 11

**The page's taskbar strip is the linear layout's strip**: fixed bottom, ~44px plus the
safe-area inset, launchers as `/#<mount>` anchor links, no gauges or window buttons, and
the CRT toggle at its right end (hidden until the inline script reveals it). Do not design
a second strip.

**A Section and the page frame are one family.** Same bevel and amber title bar, and the
same maximise-box glyph meaning "this node's page". The page masthead should read as a
Section grown to full height, so a mobile visitor tapping a Section's maximise box sees
the same object get bigger, even without a transition.

## Answer

The captain took every recommendation in the round.

### URLs

**A page's URL is its node path with the extension dropped, with a trailing slash.**
`projects/orbital-mesh/readme.md` → `/projects/orbital-mesh/`; a note →
`/projects/orbital-mesh/notes/`; `pages/about` → `/about/`. Every entry gets a URL,
notes included; synthetic nodes get none, which is what keeps ticket 09's "maximise box
iff the node has a URL" rule mechanical. One rule, derived from the filesystem, so the
terminal's `pwd` and the address bar agree.

### The page frame

The page's outermost framed element is the **page frame**, and it is the view-transition
morph target. A **centered column the same ~72ch as the linear layout's Sections**,
at least full viewport height, grid floor in the margins. Not full-bleed: a window growing
into a centered column reads as the same object getting bigger, where a full-bleed frame
reads as replacement. Ticket 11's "a Section grown to full height" is literally true.

### Anatomy, top to bottom

1. **Masthead**: the title bar, showing the filename, with the close box on its right
   (`<a href="/">`, ticket 09).
2. **Breadcrumbs**.
3. **Spec block**, on entries whose frontmatter carries facts.
4. **Cover**, projects only, when set.
5. **Body**, clean: no scanlines (ticket 02).
6. **Gallery**, then **footage**.
7. **Children listing**, directories only.
8. **Prev/next**.
9. **Taskbar strip**, fixed, ticket 11's strip.

Facts before prose, so the first screen answers role, tech and period; visuals after prose,
so they illustrate it rather than replace it. `pages` entries (about, contact) use the
same template with no spec block, cover or prev/next.

### Breadcrumbs

A terminal-style path, `/ projects / orbital-mesh / notes`, each segment linking to that
directory's folder page and `/` linking to the desktop. Titles are each link's accessible
name, so a screen reader hears "Orbital Mesh", not "orbital-mesh". Wrapped in a
`<nav aria-label="Breadcrumb">`.

### Spec block

A key/value list in the instrument-panel voice: **amber small-caps keys, green values**,
numerals tabular.

- Projects: `ROLE`, `PERIOD`, `STATUS`, `TECH`, `REPO`, `LIVE`.
- Drones: `CLASS`, `FRAME`, `WEIGHT`, `PROPS`, `FIRST FLIGHT`, then `HARDWARE` as a nested
  list (motors, ESC, flight controller, VTX, camera).
- Empty optional fields are **omitted**, never rendered as `—`.

### Gallery and footage, with zero JS

- **Gallery**: a grid of framed thumbnails, each a plain link to the full-size image. No
  lightbox. Images carry no scanlines, like body copy.
- **Footage**: rows of poster frame plus label, each linking out to the URL. **No iframe
  embeds**: a YouTube embed brings roughly 1 MB of third-party JS onto a page that is
  otherwise near-zero.

### Folder pages

One template branching on two facts: *has a body* and *has children*. A directory's page
shows its readme body if it has one, then its listing as a Section inside the page frame
— the same rows as the folder window. No readme means listing only. `/projects/` and
`/drones/` are ordinary folder pages. This is how a project's notes stay reachable from
its page.

### Prev/next

Siblings in the same directory, in folder-listing order (featured, then date). Notes are
out of their parent's sequence. No wraparound. Labels are titles.

### Window versus page

- **The window** carries the body, a **one-line spec strip** under the title bar
  (`WIP · 2025–PRESENT · LEAD`, `FREESTYLE · 5" · 612G`), and the `READ FULL PAGE` bar
  when the body overflows. Without the strip a drone window is anonymous prose.
- **The page alone** carries the breadcrumbs, the full spec block, cover, gallery, footage,
  children listing and prev/next.
- **The page never carries** the `READ FULL PAGE` bar, any window control except the close
  box, or anything draggable.

### Knock-on effects

- **Typeface selection (13)**: the spec block wants small caps and tabular numerals from
  the chosen face, or a convincing fallback for small caps.
- **SEO and social**: the URL scheme is now fixed, so per-entry meta has a canonical
  address to hang on. OG image generation is still fog.
- **Accessibility**: breadcrumb naming is settled above; the close box and the maximise
  box are still glyph links that need accessible names.
