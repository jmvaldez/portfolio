# Mobile layout

Type: grilling
Status: resolved
Blocked by: 09

## Question

Mobile gets a separate linear layout that keeps the desktop's chrome but drops the
metaphor. Specify it.

Settle: how window chrome translates — do title bars become section headers, and does
anything remain draggable (probably nothing); what the taskbar becomes; what replaces the
`viewer.exe` drone and the vector grid (a static render? nothing?); whether the terminal
exists on mobile at all; the breakpoint at which the desktop metaphor gives way, and
whether that is width-based or capability-based; and how navigation works without windows.

The constraint: it must read as the same product, not as a fallback someone gave up on.

## Hard constraint from ticket 04

The window manager keeps pixel geometry when the viewport shrinks, so below some width
the desktop shell degrades into overlapping windows larger than the desktop holding
them. The prototype's rescue clamp keeps every title bar reachable, but that is a floor,
not a design. **This ticket owns the breakpoint at which the desktop shell stops
rendering entirely and the linear layout takes over** — and it is a hard handover, not a
responsive squeeze. Measured from the prototype: 1024x700 is comfortable, 860x560 is
tight, 640x480 is broken.

## Hard constraint from ticket 09

**The linear layout is also the document served at `/`.** The desktop shell is a
`client:only` island, so `/` would otherwise ship an empty canvas — nothing for a crawler,
nothing without JS, on the one route that is the site's front door. Ticket 09 settled that
`/` server-renders the linear layout and the shell replaces it on hydration. The linear
layout is already "the chrome without the metaphor", so it is already the right document
for anyone who cannot or will not run the shell.

Consequences this ticket must respect:

- **The linear layout must be server-renderable with zero JS.** Nothing in it may depend
  on the island. That rules out any WebGL, and it settles the question above about what
  replaces the vector grid and `viewer.exe` on mobile: whatever it is, it must render
  without the React island existing.
- **It is one artifact serving three jobs** — mobile, the no-JS visitor, and the crawler.
  Designing it as "the mobile version" and then discovering the crawler reads it is the
  wrong order.
- **The handover this ticket owns is still a hard one.** Above the breakpoint the shell
  replaces the linear layout on hydration; below it, the shell never renders and the linear
  layout is the whole experience.
- **Navigation without windows**: promotion does not exist here. Every node link in the
  linear layout goes straight to the node's page.

## Hard constraint from ticket 10

**The breakpoint must be testable before any JS module loads.** An inline blocking script
in `<head>` decides whether to hide the linear layout and show the boot screen, and it
reads this ticket's breakpoint to do so. Whatever the breakpoint is (width or capability),
it must be expressible as a media query `matchMedia` can evaluate at first paint, and the
island must use the same query, or the boot gate and the shell will disagree about which
experience a visitor gets.

## Answer

The captain took every recommendation in the round; the downstream points below were
settled on the same defaults. This ticket designed the **linear layout** as a whole, since
ticket 09 made it one artifact for mobile, the no-JS visitor, and the crawler; the phone
is only its most common viewport.

### Breakpoint

**`(min-width: 1024px) and (min-height: 600px)`**, size only, no capability clause. One
string, shared by the inline boot gate in `<head>` and the island's `matchMedia`, so they
cannot disagree. Height is in because ticket 04 measured it mattering (860×560 tight,
640×480 broken); 600 rather than 700 because a 1366×768 laptop's viewport is ~1366×650
after browser chrome. No `pointer: fine`: a landscape iPad (1180×820) has room for the
shell, and the window manager is already on pointer events.

### Crossing it mid-session: live swap, both ways

The linear layout is always in the DOM; the gate only hides it. The island listens to the
same query: narrowing past it unmounts the shell (the window layout is already in
`sessionStorage`) and reveals the linear layout; widening past it again shows the
**Resume** line and remounts, never a boot. The rescue clamp from ticket 04 stays as a
floor for the moments before the listener fires, not as a design.

### What `/` is: one long scroll

- A **masthead** band first: name and one-line role, over the CSS grid floor. Not a
  Section.
- Then one **Section** per root-level mount, in mount-table order: about → projects →
  drones → resume → contact. Each Section's anchor id is its mount path (`#projects`).
- `about` and `contact` render their body inline. `projects` and `drones` render the
  folder listing (the same rows a folder window shows), each row linking to its page.
  `resume` is a placeholder row until the resume delivery fog clears.

### Section

A framed block with a title bar, in flow. Heavy bevelled frame, amber title bar, scanlines
on the chrome only, body clean (ticket 02). **The only title-bar control is the maximise
box, and only where the node has a URL** — a plain link to the node's page. The ticket-09
rule ("a maximise box iff the node has a URL") therefore holds on both surfaces, and
promotion survives here as a link with no transition. No minimise, no close, no drag, no
collapse: dead controls lie to a thumb.

### Taskbar strip

A **fixed bottom strip**, ~44px plus `env(safe-area-inset-bottom)`. Launchers are anchor
links: `#projects` on `/`, `/#projects` from a page. The gauges and window buttons drop:
they report live shell state and there is no shell here. The CRT toggle sits at the right
end where the gauges were, rendered hidden and revealed by the same tiny inline script
that applies the `localStorage` preference, so a no-JS visitor never sees a dead switch.
**The same strip is the taskbar strip on content pages** (ticket 12), so all three surfaces
agree.

### The 3D layer, without the island

- **Grid**: pure CSS, a perspective-transformed `linear-gradient` floor, confined to the
  masthead band and never behind body copy.
- **Drone**: a **build-time SVG** of the procedural quad's edges, generated from the same
  geometry code the viewer uses, at a fixed three-quarter angle. It sits in the drones
  Section with the viewer's crosshair and readout drawn over it in HTML. One source, so
  the two surfaces cannot drift.
- Both drop out under `forced-colors: active`.

### HUD layer

Crosshair and readout survive over the drone SVG. Kill-feed toasts and gauges drop: both
need live state.

### Terminal

**Absent.** It is always an alternate path, and the linear layout already is the direct
one. A transcript you cannot type into would be a costume, which is the theme-pack failure
the map's Notes warn against. The in-world voice may appear in one line of footer copy.

### Wide viewports

The linear layout is also what a no-JS or crawler visit sees at 1440px and up. **A single
centered column**, Sections capped at ~72ch (the 58ch body plus frame and padding), the
grid floor filling the margins. One max-width from phone to wide screen; the reading order
never changes with width.

### Knock-on effects

- **Content page template (12)**: the page's taskbar strip is this strip, CRT toggle
  included. Section and page frame share the bevel and title bar, so the page masthead
  should read as a Section grown to full height.
- **Performance budget**: a build step now renders the drone SVG from the procedural
  geometry; its size belongs in the budget.
- **Accessibility**: a Section's maximise box is a link with a glyph for a label and needs
  an accessible name ("Open <title> page"). The live swap moves focus out of an unmounted
  window, so it needs a defined landing point.
