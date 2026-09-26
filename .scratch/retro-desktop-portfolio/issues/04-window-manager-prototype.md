# Window manager: does it feel right?

Type: prototype
Status: resolved
Blocked by: —

## Question

Build a throwaway prototype of the desktop's window manager and decide, by using it,
whether the interaction is good enough to build the site on.

It needs: drag by title bar, resize from edges and corners, z-order with click-to-focus,
minimise to taskbar, close, and sane behaviour at the viewport edges. Open questions the
prototype exists to answer: hand-rolled or a library (`react-rnd`, `dnd-kit`, `winbox.js`)
— and what each costs in bundle size and in control over the chrome; whether windows
snap or float freely; what the initial desktop layout is on first load; whether window
position survives a reload; and how a window behaves when the viewport gets small.

Resolve with a recommendation, the prototype linked as an asset, and an honest note on
anything that felt worse in the hand than it looked on paper.

## Prototype

Branch `prototype/window-manager`, at
`.scratch/retro-desktop-portfolio/prototypes/04-window-manager/index.html`.
Single self-contained HTML file; `python3 -m http.server 8731` from that directory.

Three variants on one route, switchable via `?variant=` and a floating bar. They
disagree only about what the desktop *is*; drag, 8-way resize, click-to-focus
z-order, minimise, taskbar restore and maximise are shared and identical.

- **A — Free float.** Pixel-exact, no magnetism. The desktop is a canvas.
- **B — Snap zones.** Free, but drag to an edge or corner to tile; drag away to restore.
  Plus window-to-window edge magnetism at 8px.
- **C — Cell grid.** Everything quantised to a 12x8 cell grid. The desktop is a text screen.

Instruments: `S` toggles a live state panel (z-order, geometry, focus); `V` cycles a
viewport rig down to 640x480 without resizing the browser; a persistence toggle writes
the layout to localStorage per variant.

Standing on the ticket's sub-questions until the variant is picked: whether windows
snap, what the first-load layout is, whether position survives a reload, and what
happens when the viewport gets small. The hand-rolled-or-library question is answered
below.

## Answer

**Variant B: free float with snap zones. Hand-rolled, no window-manager library.**

The desktop is a canvas with opinions. Windows go anywhere at any size, but the edges
and corners tile them, and they magnetise to each other. Variant C's cell grid felt
better in the hand than expected and looked the most Commodore, but it cannot size a
window to its content, and with the content model still open that is a constraint we
would be buying blind.

### Hand-rolled, not a library

All three variants plus every instrument came to 423 lines of JavaScript and 139 of
CSS; the shared window-manager core is roughly half the JS. `react-rnd` alone is about
30 KB gzip for a subset of that, and it owns the DOM structure of the chrome — which is
exactly the part the CRT treatment needs total control over, since ticket 02 already
rules out getting bloom from a wrapper `filter`. A library buys convenience in the
cheap part and spends control in the expensive one.

### Behaviour, as settled

- **Snapping.** Release within 26px of an edge and the window tiles: left and right
  edges give halves, corners give quarters, the top edge maximises. A dashed preview
  of the target shows during the drag. Dragging a snapped or maximised window tears it
  free and restores its pre-snap size, centred under the cursor.
- **Magnetism.** 8px window-to-window and window-to-edge, on both axes, while free.
- **First-load layout.** Seed geometry is expressed as **fractions of the canvas**,
  never fixed pixels. A composed four-window arrangement, not a cascade.
- **Position across reloads.** Not persisted in v1. Every visitor gets the arrangement
  we designed, and the first impression stays ours. Revisit only if the terminal or a
  later feature gives a returning visitor a reason to have arranged something.
- **Small viewports.** Windows keep their pixel geometry, so a shrinking desktop can
  push one out of reach; a rescue clamp on every viewport change keeps each title bar
  reachable. That clamp is a floor, not a solution — see the honest note below.
- **Shared, and not in question:** title-bar drag, 8-way resize (min 200x120),
  click-to-focus z-order, minimise to taskbar, taskbar click to restore or re-minimise,
  close, double-click title bar to maximise.

### Honest notes

- **The rescue clamp is minimal and it shows.** At 640x480 you get four reachable title
  bars attached to four windows that badly overflow the desktop. The real answer is
  that the desktop shell should never be rendered at that size — the mobile linear
  layout should have taken over well before it. **Mobile layout** owns that breakpoint,
  and this is now a hard requirement on it rather than a preference.
- **Variant C deserves a second look later.** Quantised dragging genuinely feels better
  because you stop aiming, and it is the only model that cannot lose a window. If the
  content model turns out to produce uniformly-sized content, revisit.
- **Fixed-pixel seed layouts are a trap** — see Hazards on the map.

