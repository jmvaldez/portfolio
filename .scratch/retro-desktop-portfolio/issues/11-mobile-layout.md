# Mobile layout

Type: grilling
Status: claimed
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
