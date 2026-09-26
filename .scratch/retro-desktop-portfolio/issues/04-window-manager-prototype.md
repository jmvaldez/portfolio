# Window manager: does it feel right?

Type: prototype
Status: claimed
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
