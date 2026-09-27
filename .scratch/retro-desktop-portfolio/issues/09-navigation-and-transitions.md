# Navigation and transition model

Type: grilling
Status: resolved
Blocked by: —

## Question

The shape is hybrid: short sections open in-window, long ones hard-navigate to a real
page. Draw the line precisely and specify the seam.

Settle: which of `about`, `projects`, `drones`, `resume`, `contact` open in-window and
which navigate; what the transition looks like when a window becomes a page (does it
maximise and fill, or is it a cut); what the URL does in each case, and whether an
in-window section is linkable; how a content page gets back to the desktop, and whether
the desktop's state (open windows, positions) survives the round trip; and what a
deep-linked visitor sees when they arrive on a content page without ever seeing the
desktop.

The risk to name explicitly: the shell and the pages must not feel like two different
websites.

## Resolution

**Promotion is the navigation.** Ticket 09's framing ("short sections open in-window,
long ones hard-navigate") contradicted ticket 05, which had already settled that windows
hold the full body. The contradiction is resolved in 05's favour: nothing is a preview.
A content or folder window holds the whole body, and its **maximise box navigates to the
node's page**. The seam is not a metaphor — promotion to the page is what maximise
*means*.

**A window has a maximise box if and only if its node has a URL.** Pages exist for
collection entries and the directories holding them; synthetic nodes (easter eggs, inline
text, grouping directories) are shell-only. A missing box is therefore informative, not a
bug. A body taller than its window carries a persistent amber `READ FULL PAGE` bar, so a
recruiter who never touches a maximise box is still told where the real thing is.

**The shell never mutates the URL.** It is always `/`. An in-window section is not
linkable and does not need to be, because every promotable node already has a canonical
address — one address per entry, no canonicalisation problem, and Back means "leave the
site" because nothing was pushed. This also keeps the design clear of the unfixed
`history.pushState` desync in Astro's router (see research, Q6).

**The terminal never navigates.** Everything it does happens inside the shell. A typed
command that can tear down the document is an unbounded set of ways to lose desktop
state, and the terminal was already ruled out as primary navigation.

**A page carries the chrome and drops the metaphor** — bevelled frames, amber and green,
mono, title-bar masthead, taskbar strip; no dragging, no snapping, no desktop surface.
Full CRT treatment on the chrome, body-copy area clean, which is exactly the per-surface
split ticket 02 made the treatment for. The page never auto-boots the shell. This is the
same translation the map already committed to for mobile, so it is one rule serving two
surfaces: *the page is to the desktop what the mobile layout is to the desktop*. That is
the concrete answer to "must not feel like two different websites" — it is not two sites,
it is one chrome with the metaphor switched off.

**Return is a close box** on the masthead's right, and it is a plain `<a href="/">`, not
`history.back()`. In-world gesture, works with zero JS, and behaves identically for a
deep-linked visitor who has no history to go back to — `history.back()` would send them
off the site entirely.

**`/` server-renders the linear layout**, and the shell replaces it on hydration. The
shell is `client:only`, so `/` was the one route in the site with nothing for a crawler
and nothing without JS. The linear layout is already "chrome without metaphor", so it is
already the right document for anyone who cannot or will not run the shell. One artifact,
three jobs: mobile, the no-JS visitor, the crawler.

### The transition: native cross-document view transitions, no Astro router

`@view-transition { navigation: auto }`, **scoped to the outbound direction only**. The
window-frame-into-page-frame morph is the *default* group animation, so the
differently-sized interpolation of `::view-transition-group()` gives the effect for free.

**Astro's `<ClientRouter />` is excluded, and not on a trade-off.** `transition:persist`
cannot keep the shell alive across a navigation to a page that omits the element — the
shipped swap code discards an unmatched element and Astro's own repo has a test named
`'transition:persist drops elements without matching target in new page'`. The only way to
persist the shell is to emit the persist target on *every* page, which means every content
page ships and runs the 237 KB three + R3F island while the recruiter reads. Ticket 01
measured content pages at 0 KB JS and the map locks "content pages near-zero JS", so the
router option is incompatible with a constraint already closed. Secondary strike:
`<ClientRouter />` silently sets `prefetchAll: true` on every link, overwriting the
selective prefetch policy below.

Mechanics this commits to:

- `view-transition-name` is applied to **exactly the window being promoted**, in the click
  handler immediately before navigating — never statically to every window. Two elements
  sharing a name silently skips the entire transition.
- The destination page's outer frame carries the matching name.
- Under `prefers-reduced-motion` the at-rule becomes `navigation: none`. The spec permits
  `@view-transition` inside `@media`, and there is **no** automatic reduced-motion
  handling for the cross-document form — unlike Astro's router, which ships it.
- **The return to `/` is a plain cut**, no transition. `/` renders the linear layout and
  then swaps it for the shell, so anything the page frame morphed into is torn out a few
  hundred milliseconds later; that reads as a glitch, not continuity. Holding the shell's
  first paint to fix it would trade a real delay for a cosmetic one. And the moment is
  already occupied: by the boot rule below, a first-time arrival at the shell gets the
  boot sequence, and the boot *is* the transition.
- Firefox has no cross-document view-transition support and its meta bug has no
  milestone, so Firefox degrades to the plain navigation — which is precisely what the
  hard-cut option would have given us everywhere, so choosing the cut outright buys
  nothing.

### State across the round trip

**Within a tab, `sessionStorage` carries** which windows are open, their geometry,
z-order, focus, and scroll position within each body. The desktop you closed a window from
is the desktop you come back to.

This **narrows** ticket 04's "window position is not persisted across reloads" rather than
reversing it: nothing goes in `localStorage`, so a cold visitor always gets 04's seed
layout. What 04 was protecting was a layout remembered across *visits*. Within a session
the close box says "close this window and return to the desktop", and a desktop that comes
back wiped makes that sentence a lie — promotion would feel like leaving the site, which
is the failure this ticket exists to prevent. Ticket 04's rescue clamp already covers a
viewport that changed size during the round trip.

**The CRT toggle is a preference, not session state**: `localStorage`, and it must be
readable by the pages as well as the shell, since a visitor who turned it off in the shell
must not have it come back on after promotion.

**Boot is gated on shell state, not route.** A visitor who lands on a content page and
clicks the close box has never seen the shell, so they get the boot on that first arrival
— the boot is the thing that explains what just happened, and the visitor who most needs
that framing must not be the one denied it. Gating on referrer would be both fiddly and
worse.

### Prefetch

Hovering a node prefetches its body file (for opening a window, as ticket 05 settled).
Hovering a **maximise box** prefetches the page. Prefetching both on every node hover
doubles the bytes for a gesture not yet chosen. This is only ownable because
`<ClientRouter />` is out of the loop.

### Constraints handed to other tickets

- **08**: the terminal never navigates. Not a decision 08 revisits.
- **10**: boot is gated on shell state, never on route; and the boot occupies the
  return-to-desktop moment, which is why the return is a cut.
- **11**: the linear layout must be server-renderable with **zero JS**, because it is also
  the document served at `/`.
- **12**: the page's outer frame is the morph target and carries the close box; the page
  carries the chrome with the metaphor off.

### Research

[Astro 7 navigation, view transitions, and island persistence](../research/09-astro7-navigation.md)
