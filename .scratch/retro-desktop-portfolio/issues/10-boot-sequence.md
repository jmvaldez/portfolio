# Boot sequence

Type: grilling
Status: open
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
