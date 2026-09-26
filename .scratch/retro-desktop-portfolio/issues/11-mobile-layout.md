# Mobile layout

Type: grilling
Status: open
Blocked by: 06, 09

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
