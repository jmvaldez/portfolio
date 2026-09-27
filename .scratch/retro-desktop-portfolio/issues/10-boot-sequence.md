# Boot sequence

Type: grilling
Status: resolved
Blocked by: —

## Question

Specify the POST-style intro: short, skippable by any keypress, once per session.

Settle: the actual lines it prints and the in-world voice they use; total duration and
per-line timing; how the skip affordance is communicated without breaking the illusion;
where "once per session" is stored and what a returning visitor sees instead; what a
deep-linked visitor arriving on a content page sees (presumably no boot at all); and
what it does under `prefers-reduced-motion`.

The failure mode to design against: a theatrical boot is the single most common reason
sites like this get hated.

## Hard constraints from ticket 09

**Boot is gated on shell state, never on route.** The parenthetical in the question above
— "what a deep-linked visitor arriving on a content page sees (presumably no boot at
all)" — is **overturned**. A visitor who lands on `/projects/foo` from a link and then
clicks the page's close box has never seen the shell, so they get the full boot on that
first arrival at `/`. The boot is the thing that explains what just happened, and the
visitor who most needs that framing must not be the one denied it. Gating on referrer is
fiddly and worse. "Once per session" is therefore keyed on *has the shell booted this
session*, not on which URL the visitor entered through.

They see no boot **on the content page itself** — the page never boots the shell at all.

**Storage is `sessionStorage`**, alongside the window-layout state ticket 09 put there.

**The boot occupies the return-to-desktop moment.** Ticket 09 made the page-to-desktop
navigation a plain cut with no view transition, partly because a first-time arrival at the
shell already has the boot playing there. Whatever this ticket specifies for a *returning*
visitor (who has already booted this session) is what fills that moment on a round trip —
so "what a returning visitor sees instead" is now load-bearing, not a detail.

## Note from ticket 08

The terminal is open (unfocused) on first arrival at the shell and prints a one-line motd,
`valdez-os 1.0 · type 'help'`, on a session's first open. Decide whether the boot's last
line hands off into that motd, or whether the two are independent. Also: the boot's
"skippable by any keypress" must not deliver that keypress to the terminal.

## Answer

Vocabulary is in `CONTEXT.md` at the repo root: **Boot** and **Resume**. The boot covers
the shell's real startup rather than delaying it; that is the whole defence against the
"theatrical boot" failure mode.

### Mechanism: the boot starts at first paint, not at hydration

`/` server-renders the linear layout (ticket 09), and the shell is a `client:only`
island, so without intervention every desktop visitor would see the linear layout flash
before the shell replaced it. A small **inline blocking script in `<head>`** (the same
pattern the CRT toggle already needs) runs only when JS is on and the viewport is above
the mobile breakpoint. It hides the linear layout and reveals a **static boot screen**:
server-rendered HTML whose lines are revealed by CSS timing. The island takes over from
the boot screen's final state when it mounts.

- **No boot wherever the shell does not render**: below the breakpoint, without JS, for a
  crawler, and on any content page. The linear layout never carries a boot.
- **Once per session** is a `sessionStorage` flag, **set when the boot starts**, so a
  reload mid-boot does not replay it. `sessionStorage` is per tab: a new tab is a new
  session and boots again. Keyed on shell state, never on route (ticket 09).
- With the CRT toggle off the boot still plays, without scanlines and bloom.

### Timing

- **Floor 600 ms, ceiling 1.5 s**, ~80 ms per line. Below ~600 ms it reads as a render
  glitch, not a boot.
- The last line waits on exactly one signal: **the shell island has mounted**. The 3D
  scene (the lazy three + R3F chunk, ticket 01) is **never** awaited; the desktop appears
  on its plain ground and the grid arrives when it arrives.
- **Hard timeout 6 s**, separate from the ceiling. If the island still has not mounted
  (JS error, blocked script, very slow link), the boot screen is removed and the linear
  layout revealed. Nobody is ever trapped on the boot.

### Returning visitor: resume

A visitor who has already booted this session (reload, or a page's close box) sees a
single line held **only as long as the shell takes to mount, with no floor**:

- `RESUME · 3 WINDOWS RESTORED` / `RESUME · 1 WINDOW RESTORED`
- `RESUME · DESKTOP RESTORED` when zero windows are open or no layout was saved.

Same static-screen mechanism as the boot. This is what fills the return leg of a
promotion round trip, which ticket 09 left as a plain cut.

### Skip

Any **key, click, or tap** skips. It **jumps** to the end state (to the resume line if the
island has not mounted yet; never a blank screen). The skipping event is swallowed: never
delivered to the terminal or the desktop. Communicated POST-style: a fixed amber bottom
line, `PRESS ANY KEY TO SKIP`, present from the first frame.

### Lines

Played straight, **no joke line**; the in-world voice lives in the terminal's errors and
easter eggs. `*` marks lines that report real state.

```
VALDEZ-OS 1.0 · BIOS REV 7.0
MEMORY TEST ............ 640K OK
PHOSPHOR ............... GREEN/AMBER OK        * "BYPASSED" when the CRT toggle is off
VECTOR UNIT ............ ONLINE                * "STANDBY" under reduced motion / no WebGL
MOUNTING /projects /drones /pages .. OK        * the real mount table (ticket 05)
LOADING DESKTOP ........ OK                    * held until the island mounts
                                     PRESS ANY KEY TO SKIP
```

Lorem-ipsum policy does not apply here: this is chrome, not content.

### Look and handoff

Full-viewport black ground; log top-left in **green** (data), header and skip line in
**amber** (chrome); CRT treatment on. Ends with a **hard cut** to the desktop, no fade.

### Reduced motion

Under `prefers-reduced-motion` the whole log renders in one frame and is held only as long
as the island takes to mount, with no floor.

### The terminal's motd

**Independent.** The boot names itself `VALDEZ-OS 1.0`, which rhymes with the terminal's
`valdez-os 1.0 · type 'help'`, but the motd never depends on the boot having run, so a
skip or a resume cannot break it.

### Knock-on effects

- **Mobile layout** must express its breakpoint as something the head script can test
  before any JS module loads (a media query), since the boot gate reads it.
- **Performance budget** gains two items: the inline head script, and the 600 ms floor
  on first-visit time-to-desktop.
- **Accessibility** gains: what a screen reader makes of the boot screen and the resume
  line (likely `aria-hidden`, with a single status announcement when the desktop is
  ready).
