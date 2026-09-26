# Window manager: does it feel right?

Type: prototype
Status: open
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
