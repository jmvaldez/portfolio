# Accessibility strategy

Type: grilling
Status: resolved
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

## Answer

The captain took the round-1 recommendations and delegated round 2 ("go with sensible
defaults and recommendations"). Everything under *Round 2* is therefore the agent's
default, not a choice the captain voiced, and is the first thing to revisit if one grates.

### Strategy: hybrid, carried by WCAG's conforming-alternate-version clause

**The shell is operable up to a bar; the linear layout is the guaranteed floor and is
reachable from the shell.** The bar is *everything that reaches content*: launching,
moving focus between windows, raising, minimising, closing, reading a body in place, and
promotion. It excludes **geometry**. There's no keyboard move, resize or snap, and no
keyboard orbit of the drone. Geometry reaches no content, and every node with content
already has a page that is a plain, fully accessible document.

**Why the linear layout cannot be the whole answer:** above the breakpoint the shell
*replaces* it at `/`, and no one can reliably detect a screen reader. So the shell carries a
**skip link**, first in the tab order and visible on focus, that reads "Skip to text layout".
It sets a **layout override** in `localStorage`, using the same mechanism as the CRT toggle.
The inline head gate from ticket 10 reads the override before first paint, so a visitor who
set it gets neither the boot nor the shell. The linear layout's taskbar strip gains a
matching **Desktop** control above the breakpoint, which clears the override.

This is exactly WCAG 2.2's *conforming alternate version*: a conforming version with the same
information and function, reachable from the non-conforming one through an
accessibility-supported mechanism. That clause, not a claim that the shell passes everything,
is what formally carries the shell's known gaps. They are 2.5.7 (dragging movements, since
window geometry is drag-only) and 2.1.4 (character key shortcuts, since backtick is
global). The linear layout loses only the terminal, which was always an alternate path.
**Conformance target: WCAG 2.2 AA** for pages and the linear layout. The shell meets it
inside the bar in good faith, without claiming it.

Rejected: a *fully operable* shell, which spends its effort on keyboard window geometry that
reaches nothing. And *linear-only, shell does the minimum*, which fails as stated because
the shell hides the linear layout.

### Forced colours and increased contrast

Neither needs its own design. Both only set the CRT toggle's default.

- `forced-colors: active`: the CRT treatment is off entirely, as though the toggle were off.
  Frames become 3px solid `CanvasText` borders. A focused window's border becomes `Highlight`
  in place of amber.
- `prefers-contrast: more`: the CRT is **off by default**, but an explicit toggle-on still
  wins. The subordinate text tokens (bylines, column headers, gauge labels) rise to full
  phosphor green or amber. Those are the ones ticket 06's hazard says fail first.

### The maximise and close boxes

- **Maximise box** on a window and on a Section: a link with `aria-label="Open <title>
  page"` and the glyph `aria-hidden`. The name says where it goes, because it navigates.
  "Maximise" would hide that, and there's nothing to maximise on a Section.
- **The `READ FULL PAGE` bar** is an ordinary link with a visible name.
- **Page close box**: `aria-label="Return to home"`. That's honest on both surfaces: above
  the breakpoint `/` is the desktop, below it `/` is the linear layout.

### The 3D

- The grid canvas is `aria-hidden="true"` and never focusable.
- `viewer.exe` keeps its window semantics (title, controls). The view inside it is
  `aria-hidden`, with a visually hidden one-line description in its place, for example
  "Wireframe model of a 5-inch FPV quadcopter, slowly rotating." Orbiting is pointer and
  touch only.

### Round 2: the calls the strategy implies

**Shell structure.** A visually hidden `h1` names the desktop. Landmarks, in DOM order: the
skip link, then the desktop icons as a labelled list of buttons, then the windows, then the
taskbar as `<nav aria-label="Taskbar">`. Each window is a `<section>` labelled by its title
bar, and its title is an `h2`. A body that scrolls is its own focus stop (`tabindex="0"`), so
the keyboard can scroll it.

**Z-order never reorders the DOM.** Windows sit in the DOM in the order they were opened.
Raising a window changes `z-index` only. Reordering nodes on raise would drop focus and
scramble the tab order under the user mid-gesture. So the tab order is open order, not
stacking order, and that's accepted.

**Focus and the window lifecycle.**
- Focus entering a window (`focusin`) raises it and lights its title bar. The amber border is
  the window-level indicator. Element-level focus also gets its own `:focus-visible` amber
  outline, never the title bar alone.
- Opening a window moves focus to its title (`tabindex="-1"`).
- Minimising moves focus to that window's taskbar button.
- Closing moves focus to the element that opened the window if it still exists, otherwise to
  the taskbar button of the next window in z-order, otherwise to the first desktop icon.
- Title-bar controls are real buttons named "Minimise <title>" and "Close <title>".
  Taskbar window buttons carry `aria-pressed`, which reflects "not minimised".
- There are no global window shortcuts beyond backtick. Everything is reachable with Tab.

**Terminal.**
- The input is a labelled `<input>` ("Terminal command"). The output is `role="log"`, which is
  polite. Each command's output is appended as **one unit** once it completes, so it's
  announced once, never line by line.
- The motd from ticket 10 is in the log from the start. It's not announced, because the
  terminal opens unfocused.
- **Backtick** opens or focuses the terminal. Toggling it closed (minimising) sends focus
  back to the element that held it before the terminal took it, otherwise to the desktop.
  It never fires while focus is in a text field other than the terminal's own input.
  2.1.4's off-switch requirement is carried by the alternate version, not by a settings
  control.
- Easter-egg output is ordinary log output. **Toasts** (kill-feed, including the Konami
  one) all go through one shared `role="status"` region.

**Boot and resume.** The boot screen and the resume line are `aria-hidden`. When the desktop
is ready, a single polite status is announced: "Desktop ready, N windows open" (or
"restored"). Focus is not moved, so the skip link is the first Tab stop.

**Live swap across the breakpoint.** Focus lands on the counterpart of whatever held it: a
window maps to its root mount's Section, and a Section maps to that mount's window if one is
open. Without a counterpart, focus goes to the surface's `h1` (`tabindex="-1"`). Either way
one polite status is announced: "Switched to text layout" or "Switched to desktop".
