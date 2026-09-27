# Content page template

Type: grilling
Status: claimed
Blocked by: —

## Question

Decide what a real content page contains, now that the content model is settled and the
window is no longer a preview of it.

A project's body renders in two shells: a window inside the desktop, and a page at its
own URL. The content is identical by decision; the *framing* is not. Settle what the
page carries that the window does not — masthead, breadcrumbs back into the tree, the
frontmatter rendered as a spec block, `gallery` and `footage` layout, prev/next between
siblings, a way back into the desktop shell — and settle the inverse: what the window
carries that the page does not.

Also settle the folder page: a directory has a folder *window* showing a listing, so
what does the same directory look like at its own URL?

Constraints already binding: no scanlines over long-form body copy (ticket 02), and
long content must stay readable for a recruiter who never touches the desktop shell.

## Hard constraints from ticket 09

**The page's outer frame is a view-transition morph target.** Promotion animates the
window frame into the page frame via native cross-document view transitions, and the
differently-sized interpolation is the default group animation — so the page's outermost
framed element must carry the matching `view-transition-name` and must be shaped so that
morphing a window frame into it reads as the same object growing. A named element forms a
stacking context and flattens 3D transforms at all times, not only during the transition.

**The page carries the chrome and drops the metaphor.** Bevelled frames, amber and green,
mono, title-bar masthead, taskbar strip; no dragging, no snapping, no desktop surface.
Full CRT treatment on the chrome, body-copy area clean. Same rule as the mobile linear
layout, so the two surfaces stay one product.

**The masthead carries a close box** on its right: a plain `<a href="/">`, not
`history.back()`. It must work with zero JS and must behave identically for a deep-linked
visitor with no history.

**The page never auto-boots the shell.**

**The CRT toggle must work on the page**, reading the `localStorage` preference the shell
writes — so the page needs whatever minimal inline mechanism applies it before first
paint, without importing the island.

**The window/page split is settled, so this ticket is only about framing.** Both surfaces
carry the identical full body (ticket 05). What the page adds is everything a window
cannot hold: masthead, breadcrumbs, the frontmatter spec block, `gallery`/`footage`
layout, prev/next between siblings. A body taller than its window shows a persistent amber
`READ FULL PAGE` bar in the window — the invitation to promote lives on the window side,
so this ticket does not owe it one.

**Folder pages are in scope and reached the same way**: folder windows promote too, same
gesture, same meaning.

## Hard constraints from ticket 11

**The page's taskbar strip is the linear layout's strip**: fixed bottom, ~44px plus the
safe-area inset, launchers as `/#<mount>` anchor links, no gauges or window buttons, and
the CRT toggle at its right end (hidden until the inline script reveals it). Do not design
a second strip.

**A Section and the page frame are one family.** Same bevel and amber title bar, and the
same maximise-box glyph meaning "this node's page". The page masthead should read as a
Section grown to full height, so a mobile visitor tapping a Section's maximise box sees
the same object get bigger, even without a transition.
