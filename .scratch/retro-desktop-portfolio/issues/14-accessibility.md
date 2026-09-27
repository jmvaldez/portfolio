# Accessibility strategy

Type: grilling
Status: open
Blocked by: —

## Question

Contrast under the CRT is already solved (ticket 06), and so is reduced motion for the
promotion transition (ticket 09). What's still open is how a keyboard user and a
screen-reader user get through a desktop metaphor. Decide the strategy, then the specific
calls it implies:

- **Window manager by keyboard** (ticket 04): how focus moves between windows, whether
  windows can be moved or snapped from the keyboard or only raised and closed, and what
  the tab order is across the desktop icons, windows and taskbar.
- **The maximise box is a link** (tickets 09, 11): its accessible name in a window and on
  a linear-layout Section, and whether promotion can be reached from the keyboard at all.
- **Terminal** (ticket 08): whether output is announced as it prints (a live region, and
  how polite), how the backtick Quake toggle interacts with focus, and the easter-egg noise.
- **Boot and resume** (ticket 10): the boot screen is probably `aria-hidden`, with a single
  status announcement once the desktop is ready. Confirm or overturn that.
- **Live swap across the breakpoint** (ticket 11): where focus lands when the shell and the
  linear layout replace each other.
- **The 3D**: what `viewer.exe` and the grid expose (probably a text alternative on the
  window, with the canvas itself hidden).
- `prefers-contrast: more` and `forced-colors: active` for the CRT overlay (a hazard from
  ticket 02).

The strategy might be "the linear layout is the accessible path and the shell does the
minimum". It might also be "the shell is fully operable". Pick one, knowing the linear
layout already exists at `/` without JS.
