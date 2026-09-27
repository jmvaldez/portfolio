# Research: Astro 7 navigation, view transitions, and island persistence

Supports ticket `.scratch/retro-desktop-portfolio/issues/09-navigation-and-transitions.md`.
Date: 2026-09-27. Facts only — no design recommendation is made here.

## Versions every claim below is pinned to

| thing | version | how dated |
| --- | --- | --- |
| `astro` latest stable | **7.3.5** (published 2026-09-24) | `registry.npmjs.org/astro` `.dist-tags.latest` + `.time` |
| `astro` 7.0.0 | 2026-06-22 | same |
| `astro` 6.0.0 | 2026-03-10 | same |
| `astro` last 5.x | 5.18.2, 2026-05-26 | same |
| `mdn/browser-compat-data` | 8.1.3, snapshot `2026-09-27T00:02:33Z` | `bcd.developer.mozilla.org/bcd/api/v0/current/...` `__meta` |
| current browsers at time of writing | Chrome 154 (2026-09-22), Safari 27 (2026-09-14), Firefox 156 (2026-09-15) | BCD `browsers.*.releases`, `status: current` |

Two kinds of evidence appear below and are always labelled:

- **Docs** — a sentence on `docs.astro.build`, MDN, or a W3C/Khronos spec.
- **Shipped source** — the actual published bytes of `astro@7.3.5` fetched from
  `cdn.jsdelivr.net/npm/astro@7.3.5/...`, or a test in the `withastro/astro` repo at
  `main`.

Where the two disagree, or where the docs are silent, it says so.

---

## 1. Client-side routing in Astro 7

**`<ClientRouter />` from `astro:transitions` is still the component, unchanged, and
it is the only one.** Nothing was renamed, split, or replaced in 6 or 7; the renames
all happened earlier, and the leftovers of that history were *deleted* in 6 and 7.

The exact API today:

```astro
---
import { ClientRouter } from 'astro:transitions';
---
<head>
  <ClientRouter />           <!-- or fallback="animate" | "swap" | "none" -->
</head>
```

- One prop only: `fallback`, type `Fallback = 'none' | 'animate' | 'swap'`, default
  `'animate'`. Docs: <https://docs.astro.build/en/reference/modules/astro-transitions/>
  ("`<ClientRouter />` — Added in: astro@5.0.0"; "The `<ClientRouter />` component
  accepts the following props: `fallback` … Default: `animate`").
  Shipped source confirms exactly that and nothing more:
  `astro@7.3.5/components/ClientRouter.astro` opens with
  `export interface Props { fallback?: Fallback }` and
  `const { fallback = 'animate' } = Astro.props;`.
- `astro:transitions` also exports the `fade` and `slide` animation factories.
- `astro:transitions/client` exports `navigate`, `supportsViewTransitions`,
  `transitionEnabledOnThisPage`, `swapFunctions`, and the types `Direction`,
  `Fallback`, `NavigationTypeString`, `Options`,
  `TransitionBeforePreparationEvent`, `TransitionBeforeSwapEvent`.
- `navigate(href, options)` options: `history: 'auto' | 'push' | 'replace'`
  (default `'auto'`), `formData`, `info`, `state`, `sourceElement`.
- Markup-level controls, all unchanged: `data-astro-reload` (force a full page load;
  works on `<a>` and `<form>`), `data-astro-history="auto|push|replace"`,
  `data-astro-rerun` (re-execute an inline script after every swap).
- Lifecycle events, unchanged: `astro:before-preparation`,
  `astro:after-preparation`, `astro:before-swap`, `astro:after-swap`,
  `astro:page-load`.
- Transition directives, unchanged: `transition:name`, `transition:animate`,
  `transition:persist`, `transition:persist-props`.

What *did* change since Astro 5, all of it subtractive:

- **Astro 6 removed `<ViewTransitions />` entirely.** Docs,
  <https://docs.astro.build/en/guides/upgrade-to/v6/> → "Removed:
  `<ViewTransitions />` component" (PR #14400): "In Astro 5.0, the
  `<ViewTransitions />` component was renamed to `<ClientRouter />` … Astro 6.0
  removes the `<ViewTransitions />` component entirely and it can no longer be used
  in your project."
- **Astro 6 removed the `handleForms` prop.** Same page, "Removed: `handleForms`
  prop for the `<ClientRouter />` component" — form handling is unconditional now
  (`<form>` GET and POST are intercepted; opt out per form with
  `data-astro-reload`).
- **Astro 7 removed the transitions internals that Astro 6 deprecated.** Docs,
  <https://docs.astro.build/en/guides/upgrade-to/v7/> → "Removed: exposed
  `astro:transitions` internals" (PR #16725): `TRANSITION_BEFORE_PREPARATION`,
  `TRANSITION_AFTER_PREPARATION`, `TRANSITION_BEFORE_SWAP`,
  `TRANSITION_AFTER_SWAP`, `TRANSITION_PAGE_LOAD`,
  `isTransitionBeforePreparationEvent()`, `isTransitionBeforeSwapEvent()`,
  `createAnimationScope()`. Compare event types against the string literals instead.

The Astro 7 release post (<https://astro.build/blog/astro-7/>) does not mention
transitions, browser-side routing, prefetch, or islands at all — it is compiler
speed, Vite 8/Rolldown, Sätteri, Advanced Routing (server-side), route caching, and
agent ergonomics.

One editorial note the docs now carry that Astro 5's did not emphasise, worth quoting
because it is the team's own position:

> "However, as browser APIs and web standards evolve, using Astro's
> `<ClientRouter />` for this additional functionality will increasingly become
> unnecessary. We recommend keeping up with the current state of browser APIs so you
> can decide whether you still need Astro's client-side routing for the specific
> features you use."
> — <https://docs.astro.build/en/guides/view-transitions/>

**Bottom line:** `import { ClientRouter } from 'astro:transitions'`, one prop
`fallback` — identical to Astro 5, because every rename and removal in 6/7 deleted
*older* spellings, not this one.

---

## 2. Island persistence across a navigation that omits the island

**`transition:persist` still exists and still works on a `client:only="react"`
island. But a route whose HTML omits the persisted element destroys it — the node is
not rescued, it goes away with the old `<body>`.** Both the docs and the shipped
source say so, and there is a named regression test asserting it.

Docs, the operative sentence, from "Client-side navigation process" in
<https://docs.astro.build/en/guides/view-transitions/>:

> "Elements marked `transition:persist` are moved over to the new DOM **if they exist
> on the new page**."

and from "Maintaining State" on the same page:

> "You can also place the directive on an Astro island (a UI framework component with
> a `client:` directive). **If that component exists on the next page**, the island
> from the old page with its current state will continue to be displayed, instead of
> replacing it with the island from the new page."

So the "must exist on both pages" requirement absolutely still holds in Astro 7. The
docs never state the negative case explicitly — they only ever describe the positive
one — but the shipped code is unambiguous.
`astro@7.3.5/dist/transitions/swap-functions.js`, `swapBodyElement()`:

```js
for (const el of oldElement.querySelectorAll(`[${PERSIST_ATTR}]`)) {
  const id = el.getAttribute(PERSIST_ATTR);
  const newEl = newElement.querySelector(`[${PERSIST_ATTR}="${id}"]`);
  if (!newEl) continue;                  // <-- no match on the new page: not rescued
  persistPairs.push({ old: el, newTarget: newEl });
  if (moveBefore) moveBefore(docEl, el, null); else docEl.appendChild(el);
}
oldElement.replaceWith(newElement);      // <-- old body, and the unmatched element, discarded
```

And, in the repo at `main`, `packages/astro/e2e/view-transitions.test.ts:1726` — a test
whose whole purpose is this case:

```ts
test('transition:persist drops elements without matching target in new page', …
  // Navigate via client-side link to a page WITHOUT a matching persist target
  await page.click('#click-no-canvas');
  …
  expect(await page.locator('#my-canvas').count()).toBe(0);
```

Applied to the concrete question — `/` holds the persisted shell, `/projects/foo` does
not include it:

1. `/` → `/projects/foo`: the shell's `<astro-island>` finds no
   `[data-astro-transition-persist="…"]` match in the incoming body, is skipped by the
   rescue loop, and is detached along with the old `<body>`. DOM node gone, React
   state gone, canvas gone.
2. `/projects/foo` → `/`: `/`'s static HTML carries a fresh, empty
   `<astro-island client="only">`, which hydrates from scratch. New React root, new
   R3F `<Canvas>`, new WebGL context, seed window layout, boot state re-derived.

Two consequences of that teardown path that the docs do *not* cover, flagged as
**inference from source, not documented**: because the node is discarded by detaching
the old `<body>` rather than by React unmounting, React never runs cleanup, so R3F's
`<Canvas>` unmount path — the one ticket 01 verified calls `forceContextLoss()` —
never fires. The context is only reclaimed when the detached tree is
garbage-collected, which is neither synchronous nor guaranteed before the next context
is created. On a browser with a live-context cap that is the shape of a leak; I did
not measure it.

The documented "known limitations" of `transition:persist` are narrower than that and
unchanged from Astro 5:

> "Not all state can be preserved in this way. The restart of CSS animations and the
> reload of iframes cannot be avoided during view transitions even when using
> `transition:persist`."

Three further mechanics worth having on record:

- **Matching across differently-shaped pages.** `transition:persist="some-name"` (the
  value shorthand) or `transition:name` + `transition:persist` lets the element live
  in a different component on each page. The match is on the *name*, not the DOM
  position.
- **Props.** By default a persisted island keeps state but re-renders with the new
  page's props; shipped source sets `ssr=""` and copies the new `props` attribute onto
  the carried-over `<astro-island>` when they differ. `transition:persist-props`
  (astro@4.5.0) suppresses that.
- **The maintainer-blessed workaround for exactly this shape**, from martrapp (the
  transitions maintainer) in `withastro/astro` issue #8781:
  > "The component doesn't necessarily have to be visible on all pages, it could also
  > be styled to be outside the viewport or have `display: none`."

  That is a repo comment, **not documentation**. And an unresearched wrinkle: with
  `display: none` a `<canvas>` measures 0×0, so R3F's resize observer would see a
  zero-size viewport; moving it off-screen rather than hiding it avoids that. I tested
  neither.

**Bottom line:** persist requires the element in *both* documents' HTML — omit it on
`/projects/foo` and the island is destroyed on the way out and rebuilt from zero on
the way back; the only way to keep it is to emit the persist target on every page that
participates.

---

## 3. A live WebGL canvas carried across a persisted navigation

**Nothing in the Astro *documentation* says anything about canvases or WebGL contexts
across a swap. The Astro *repository* does: there is a merged fix whose stated purpose
is preventing WebGL context loss during the swap, plus an e2e test asserting canvas
contents survive. The claim "moving a canvas preserves its context" is specified
nowhere — WebGL leaves context loss entirely to the UA — so it is implementation
behaviour, and Safari 18 is the documented counterexample.**

What is documented (Astro): nothing. The docs PR that would have said so —
`withastro/docs` #13339, "docs: update `transition:persist` known limitations for
canvas", companion to the code fix — was **closed unmerged** on 2026-03-04 during the
v5-docs freeze ("we are currently in a v5 docs freeze … not accepting any changes"),
redirected to discussion #13346, and never landed. The live "Known limitations" note
still mentions only CSS animations and iframes. So on this question the docs are
silent, and silently so.

What is in the repo (this is the substantive evidence):

- **`withastro/astro` issue #15727** (2026-03-03, closed 2026-03-05), "Safari 18: View
  Transitions break CSS rendering and cause WebGL context loss on
  `transition:persist` canvas". Bug 3 in that report: `swapBodyElement()` called
  `oldBody.replaceWith(newBody)` *before* rescuing persisted elements, so the canvas
  was momentarily disconnected from the document. Reporter: "Chrome and Firefox don't
  lose the WebGL context during brief DOM detachment, but Safari does." Astro's triage
  bot reproduced it and confirmed the root cause at `swap-functions.ts:73-98`.
- **PR #15728**, "fix(transitions): prevent WebGL context loss on persist canvas
  during Safari swap", **merged 2026-03-05**. It lifts every
  `[data-astro-transition-persist]` element to `<html>` *before* the body
  `replaceWith()`, so persisted nodes are never disconnected, then places them into
  the new body. On review it was reworked to use `moveBefore()` where available.
  I verified which release it landed in by diffing published bytes: the `docEl` lift is
  present in `astro@6.0.0/dist/transitions/swap-functions.js` and absent from
  `astro@5.18.2`'s. **So this is an Astro 6.0.0 fix, and it is in 7.3.5.**
- The shipped 7.3.5 code, same file, is the version quoted in §2 above:
  `moveBefore(docEl, el, null)` when `typeof docEl.moveBefore === 'function'`, else
  `docEl.appendChild(el)`; then `oldElement.replaceWith(newElement)`; then
  `moveBefore(newTarget.parentNode, el, newTarget)` / `newTarget.replaceWith(el)`.
- Regression test, `packages/astro/e2e/view-transitions.test.ts:1697`:
  `test('transition:persist preserves canvas pixel data across navigation')` — it draws
  a red rect via a **2D** context, navigates, and re-reads `getImageData`. There is no
  WebGL assertion in the e2e suite; the WebGL claim lives only in the PR title and
  changeset.

What the platform specs say:

- **`document.adoptNode` never touches the persisted canvas, so that edge case does
  not arise here.** Astro parses the incoming page with `DOMParser` into a *separate*
  inert document (`parser.parseFromString(...)`, `router.js`), and the only thing
  adopted into the live document is the *new* `<body>`. The canvas is an *old*, live
  node moved within the current document. `moveBefore()` in fact refuses
  cross-document moves: MDN, `Element.moveBefore()` — "It can only work when moving a
  node within the same document", throwing `HierarchyRequestError` otherwise.
- **MDN's list of what `moveBefore()` preserves does not include canvas or WebGL
  state.** It lists: animation and transition state, `<iframe>` loading state,
  `:focus`/`:active`, fullscreen element state, popover open/close, `<dialog>` modal
  state. Canvas is conspicuously absent — which is not a denial, just silence.
  <https://developer.mozilla.org/en-US/docs/Web/API/Element/moveBefore>
- **`moveBefore()` is not in Safari.** BCD 8.1.3: chrome 133, edge 133, firefox 144,
  opera 118, samsung 29 — `safari: false`, `safari_ios: false`. So on Safari, Astro
  takes the `appendChild`/`replaceWith` branch; what saves Safari is the *lift*
  (staying connected), not `moveBefore`.
- **The WebGL spec does not enumerate causes of context loss at all.** WebGL 1.0
  (`registry.khronos.org/webgl/specs/latest/1.0/`), "The Context Lost Event": "When the
  user agent detects that the drawing buffer associated with a
  `WebGLRenderingContext` context has been lost, it must run the following steps…".
  Elsewhere it says implementations "use context lost and restored events to regulate
  power and memory consumption" and "are very likely to decide to lose background
  high-performance contexts". There is no guarantee anywhere that reparenting — or even
  *not* reparenting — preserves a context.

Documented vs folklore, stated plainly:

| claim | status |
| --- | --- |
| Astro moves persisted elements to `<html>` before the body swap so they stay connected | **shipped source**, astro ≥ 6.0.0 |
| the reason it does that is WebGL context loss | **repo** (PR #15728 title + body, issue #15727), not docs |
| a persisted canvas's *2D* pixel data survives a swap | **tested in-repo** (e2e) |
| a persisted canvas's *WebGL* context survives a swap | **not documented, not tested in-repo.** Reasonable, and structurally more likely than before the fix, but unverified |
| "moving/adopting a canvas node preserves the context" as a general platform rule | **folklore.** Unspecified by WebGL; Safari 18 was an observed counterexample on mere detachment |
| Astro reaches for `document.adoptNode` on the canvas | **false** — the canvas is never cross-document; only the incoming inert `<body>` is |

**Bottom line:** the docs say nothing; the code was deliberately changed in Astro 6 to
keep persisted nodes connected *because* a canvas lost its WebGL context, and that fix
is in 7.3.5 — but "WebGL survives the swap" is inferred from a PR title and a code path
never tested for WebGL, and the platform guarantees nothing.

---

## 4. Cross-document view transitions on the platform, late 2026

**Chromium since 126 and Safari since 18.2. Firefox has still not shipped it, and has
no milestone.** MDN's own banner on `@view-transition`: "Limited availability — This
feature is not Baseline because it does not work in some of the most widely-used
browsers."

BCD 8.1.3, `css.at-rules.view-transition`, snapshot 2026-09-27:

| browser | cross-document `@view-transition` |
| --- | --- |
| Chrome / Chrome Android / Edge / WebView Android | **126** (2024-06-11) |
| Opera / Opera Android | 112 / 83 |
| Samsung Internet | 28.0 |
| Safari / Safari iOS / WebView iOS | **18.2** (2024-12-11) |
| **Firefox / Firefox Android** | **not supported**, `impl_url: https://bugzil.la/1860854` |

Firefox bug 1860854, queried live 2026-09-27 via the Bugzilla REST API: "[Meta]
Implement CSS View Transitions 2", status **NEW**, resolution empty,
`target_milestone: ---`, last changed 2026-09-24. Firefox is currently 156.

Important asymmetry that invalidates the usual Astro-5-era line ("view transitions only
work in Chromium"): **same-document view transitions *are* in Firefox now.** BCD:
`Document.startViewTransition` — chrome 111, safari 18, **firefox 144**;
`view-transition-name` is "Baseline 2025 — Newly available … Since October 2025".
Astro's docs have not caught up: "The `<ClientRouter />` router works best in browsers
that support View Transitions (i.e. Chromium browsers)". Since Astro's router calls
`document.startViewTransition`, Astro's animated navigation now works in Firefox 144+,
while the CSS-only cross-document form still does not.

### Requirements

Spec, css-view-transitions-2 §8.1.1 — all five must hold:

> "Both documents are of the same origin; the page is visible throughout the entire
> course of the navigation; the user initiates the navigation by interacting with the
> page, e.g. by clicking a link or submitting a form; or by interacting with the
> browser UI to do a traverse navigation (back/forward). This excludes, for example,
> navigations initiated by the URL bar; the navigation didn't include cross-origin
> redirects; and both documents opted in to cross-document view transitions, using the
> `@view-transition` rule."

MDN adds the navigation-type framing: `navigation: auto` applies when the
"navigationType is `traverse`, `push`, or `replace`", and for push/replace "the
navigation must be initiated by a user interacting with the page content, not by a
browser UI feature".

**"No client-side router" is not stated as a rule anywhere** — it follows mechanically.
A cross-document transition is triggered *by a document navigation*; a client-side
router cancels the navigation. Astro's does exactly that — shipped
`ClientRouter.astro`: `ev.preventDefault(); navigate(href, {...})`. So with
`<ClientRouter />` installed on a page, link clicks never produce a cross-document
navigation and `@view-transition` never fires for them. The docs' nearest explicit
statement is on the module reference: "This API is compatible with the
`<ClientRouter />` included in `astro:transitions`, but can't be used with native
browser MPA routing." Treat "the two are mutually exclusive per link" as **inference
from shipped source**, clearly reasoned but not written down.

### Morphing into a differently-sized element on the next document

**Yes, and it is the default behaviour of the group pseudo-element.** Two documented
statements, both MDN "Using the View Transition API":

- "by default, `::view-transition-group()` transitions `width` and `height` between the
  old and new views with a smooth scale."
- on exceptions to the default cross-fade: "`height` and `width` transitions have a
  smooth scaling animation applied."

Pairing across the two documents is purely by name, and the spec is explicit that the
two elements need not be related:

> "if one element has view transition name `foo` in the old state, and another element
> has view transition name `foo` in the new state, they are treated as representing
> different visual state of the same element, and will be paired in the view
> transition tree. This may be confusing, since the elements themselves are not
> necessarily referring to the same object, but it is a useful model…"
> — css-view-transitions-1 §2.1

So a 420×300 window on `/` and a full-bleed `<article>` on `/projects/foo` sharing
`view-transition-name: win-projects` is the documented, intended shape of the "window
maximises into a page" effect. One relevant knob for getting it to look right:
cross-document transitions have no `startViewTransition` callback to await, so the UA
"relies on the render-blocking mechanism to decide when the document has reached a
stable state", and authors use the `blocking` attribute on required scripts/styles to
delay the transition until layout is settled (css-view-transitions-2 §8.1.2).

### Documented constraints

- **One element per name, or the whole transition is skipped.** MDN,
  `view-transition-name`: "The `view-transition-name` `<custom-ident>` must be unique
  for each rendered element taking part in the view transition. If two rendered
  elements have the same `view-transition-name` at the same time, the
  `ViewTransition.ready` Promise will reject and the transition will be skipped." Note
  the failure mode is *silent loss of the whole animation*, not a partial one.
- **`match-element` cannot be used cross-document.** MDN: "Because `match-element`
  assigns automatic `view-transition-name` values based on element identity, it can only
  be used for same-document view transitions." (`match-element`: chrome 137,
  safari 18.4, firefox 144.)
- **A named element permanently changes its own rendering, transition or not.**
  css-view-transitions-1 §2.1.1 "Rendering Consolidation": elements "whose
  `view-transition-name` computed value is not `none` (**at any time**)" — "Form a
  stacking context. Are flattened in 3D transforms. Form a backdrop root." That is the
  one to watch on this project: naming a window makes it a stacking context and
  flattens 3D transforms inside it, all the time, not just during the animation.
- **Fragmented elements silently drop out.** css-view-transitions-1: the property "has
  no effect" if the principal box "is fragmented, skipped, or not rendered", and the
  capture algorithm reads "If element has more than one box fragment, then continue"
  with the note "We might want to enable transitions for fragmented elements in future
  versions". Inline boxes broken across *line* boxes are exempt: "box fragment here
  does not refer to fragmentation of inline boxes across line boxes. Such inlines can
  participate in a transition." Practically: a named element inside multi-column layout
  or paged media is excluded.
- **`contain` is not a requirement.** I searched css-view-transitions-1 for containment
  prose and found none; the containment story is instead the *snapshot containing
  block*, below.
- **`position: fixed`.** No spec or MDN text calls out a "fixed-position gotcha" by
  name — **the docs don't say**. What *is* specified is the mechanism that produces
  one: the snapshot containing block "is a rectangle that covers all areas of the
  window that could potentially display page content", and it "is considered to be an
  absolute positioning containing block and a fixed positioning containing block for
  `::view-transition` and its descendants"; the L1 change log records "Use
  `position: absolute` instead of `position: fixed` on `::view-transition`". Snapshots
  are therefore static images positioned inside that rectangle for the duration of the
  animation, not live fixed-position boxes. Whether that reads as a bug in a given
  design is an empirical question, not a documented one.
- **Snapshot size cap.** The capture algorithm: "If the snapshot containing block size
  exceeds an implementation-defined maximum, then return failure" — the whole
  transition is skipped on a sufficiently large viewport. No number is given.
- **Accessibility.** "The view transition tree is not exposed to the accessibility
  tree" (css-view-transitions-1 §3.2).
- **Reduced motion: not addressed by the spec.** See §5.
- The `types` descriptor (`@view-transition { navigation: auto; types: slide }`),
  `:active-view-transition` / `:active-view-transition-type()`, `view-transition-class`,
  and the `pageswap` / `pagereveal` events are the documented customisation surface for
  cross-document transitions (css-view-transitions-2; MDN View Transition API).

**Bottom line:** cross-document view transitions are Chromium 126+ and Safari 18.2+,
still absent from Firefox with no milestone; they need same-origin, no cross-origin
redirect, a user-initiated navigation, the at-rule in *both* documents, and an actual
document navigation (so not through Astro's router) — and morphing a small named box
into a large one on the next document is the default behaviour of
`::view-transition-group()`.

---

## 5. `prefers-reduced-motion` and view transitions

**Astro's router handles it for you and documents that it does. The CSS cross-document
form has no handling at all — not in the spec, not on MDN — so it is purely the
author's job.**

### Astro's router: documented and implemented

Docs, <https://docs.astro.build/en/guides/view-transitions/> ("prefers-reduced-motion"):

> "Astro's `<ClientRouter />` component includes a CSS media query that disables all
> view transition animations, including fallback animation, whenever the
> `prefers-reduced-motion` setting is detected. Instead, the browser will simply swap
> the DOM elements without an animation."

The implementation is `astro@7.3.5/components/viewtransitions.css`, in full:

```css
@media (prefers-reduced-motion) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }

  [data-astro-transition-scope] {
    animation: none !important;
  }
}
```

The first rule kills the native path; the second kills the `fallback="animate"` path,
which animates real elements carrying `[data-astro-transition-scope]` (see
`astro@7.3.5/dist/runtime/server/transition.js`, which emits
`[data-astro-transition-scope="…"] { view-transition-name: … }` plus
`::view-transition-*` rules inside `@layer astro`). `ClientRouter.astro` additionally
logs a dev-only `console.warn` when `matchMedia('(prefers-reduced-motion)').matches`.

One thing I could not settle: that stylesheet is injected by the compiler through
`transitionsAnimationURL: 'astro/components/viewtransitions.css'`
(`packages/astro/src/core/compile/compile.ts:65` in the repo at `main`), which is the
same mechanism that ships the built-in `fade`/`slide` keyframes — i.e. it is tied to a
component *using* transition directives. **Whether the reduced-motion block is present
on a page that has `<ClientRouter />` and zero `transition:*` directives is
unverified** (it would need a real build to check). Shipping the same `@media` block
yourself in global CSS is idempotent and removes the question.

### The CSS cross-document form: nothing documented

I grepped both `css-view-transitions-1` and `css-view-transitions-2` for
reduced-motion: **zero occurrences.** MDN's `@view-transition`, `view-transition-name`
and "Using the View Transition API" pages likewise never mention it, and neither does
`developer.chrome.com/docs/web-platform/view-transitions/cross-document`. There is no
automatic suppression and no recommended recipe on any primary source. **This is a
"the docs don't say" answer.**

Two author-side forms exist, and they are not equivalent:

1. Kill the animation, keep the transition — copy Astro's block verbatim. The
   transition still runs; it just has no animation, so the swap is instant.
2. Opt out of the transition entirely. The spec explicitly permits this:
   css-view-transitions-2 §8.3.1 — "Note: as per default behavior, the
   `@view-transition` rule can be nested inside a conditional group rule such as
   `@media` or `@supports`." So
   `@media (prefers-reduced-motion: no-preference) { @view-transition { navigation: auto } }`
   is legal and means no view transition machinery runs at all under reduced motion.

**Bottom line:** Astro's router is covered and says so (`animation: none !important` on
`::view-transition-*` and `[data-astro-transition-scope]`); the CSS cross-document form
has no documented reduced-motion story anywhere, and the spec's only relevant sentence
is that you may nest `@view-transition` inside `@media`.

---

## 6. URL state from an island, without a route change

**On a page with no `<ClientRouter />`, `pushState`/`replaceState` are completely inert
with respect to Astro — there is no router script to interfere. On a page *with*
`<ClientRouter />`, direct `history.pushState` is explicitly unsupported by the
maintainers and currently breaks back-navigation, and the bug is live in 7.3.5.**

The maintainer statement, matthewp on `withastro/astro` issue #17882 (2026-09-01):

> "we don't support direct use of `history.pushState`, instead we have `navigate`
> which is for programmatic navigation."

Why, mechanically. The router owns `history.state` and stores its own bookkeeping in
it. `astro@7.3.5/dist/transitions/router.js`:

```js
if (history.state) {
  currentHistoryIndex = history.state.index;
  scrollTo({ left: history.state.scrollX, top: history.state.scrollY });
} else if (transitionEnabledOnThisPage()) {
  history.replaceState({ index: currentHistoryIndex, scrollX, scrollY }, '');
  history.scrollRestoration = 'manual';
}
```

and on traversal:

```js
function onPopState(ev) {
  if (!transitionEnabledOnThisPage() && ev.state) { location.reload(); return; }
  if (ev.state === null) { return; }            // <-- line 389 of the shipped file
  const state = history.state;
  const nextIndex = state.index;                // <-- requires the router's own shape
  const direction = nextIndex > currentHistoryIndex ? 'forward' : 'back';
  ...
}
```

It also writes scroll position back into `history.state` on `scrollend`
(`updateScrollPosition({ scrollX, scrollY })`), and forces
`history.scrollRestoration = 'manual'`.

The reproduced failure, from #17882's triage: an island calls
`history.pushState(null, '', '?testvalue=true')`, the visitor then follows a normal
link and presses Back — "URL changes to `/usePushState/?testvalue=true` but the page
content remains showing `/returnPage/`". Root cause is the `ev.state === null` early
return above: a null-state entry sits in the middle of the router's managed stack and
the router declines to handle it, so the URL and the DOM desynchronise.

**That fix has not shipped.** The issue was closed 2026-09-10 with a triage-proposed
patch, but the guard in `astro@7.3.5/dist/transitions/router.js` is still the bare
`if (ev.state === null) return;`, and nothing in `packages/astro/CHANGELOG.md` through
7.3.5 mentions `pushState` or `popstate`. Treat it as present in the latest stable.

Two safe patterns, both evidenced:

- `navigate(href, { history: 'replace', state })` — the supported API. `'replace'` uses
  `history.replaceState` under the hood and preserves `index`/`scrollX`/`scrollY`
  (shipped source, `moveToLocation`).
- If you must touch `history` directly, spread the router's state through. The
  reporter's workaround, confirmed working by triage:
  ```js
  const state = history.state ?? { index: 0, scrollX: 0, scrollY: 0 };
  history.pushState({ ...state, index: (state.index ?? 0) + 1, scrollX: 0, scrollY: 0 }, '', url);
  ```
  The same reasoning applies to `replaceState`: never pass `null`, and never drop
  `index`.

**Hash versus query string is a real, load-bearing distinction under this router.**
Shipped source, `router.js:7`:

```js
const samePage = (thisLocation, otherLocation) =>
  thisLocation.pathname === otherLocation.pathname && thisLocation.search === otherLocation.search;
```

and in `transition()`:

```js
if (samePage(from, to) && !options.formData) {
  if (direction !== 'back' && to.hash || direction === 'back' && from.hash) {
    moveToLocation(to, from, options, document.title, historyState);
    return;                                  // no fetch, no swap
  }
}
```

So a **hash**-only change on the same path+search short-circuits: no network fetch, no
DOM swap, the island keeps running. A **query-string** change is not `samePage`, so on
traversal the router treats it as a real navigation and fetches + swaps the whole
document. If an island is going to own part of the URL under this router, the hash is
categorically cheaper and safer than the query string.

**Is there documented guidance about an island owning part of the URL while the router
owns the path? No — the docs don't say.** The closest documented surfaces are
`data-astro-history="auto|push|replace"` on links, `navigate()`'s `history` and `state`
options, `data-astro-reload` to opt a link out entirely, and the note that
`navigate()`'s `state` "can then be retrieved using the `history.getState` function".
Nothing addresses an island writing the URL between navigations.

**Bottom line:** with no `<ClientRouter />` on the page, `pushState`/`replaceState` are
unaffected by Astro; with it installed, direct `pushState` is unsupported and currently
desynchronises Back in 7.3.5 — use `navigate()`, or preserve
`index`/`scrollX`/`scrollY`, and prefer the hash over the query string, because only
hash-only changes short-circuit the router.

---

## 7. Astro 6 and 7 breaking changes that invalidate Astro-5-era advice

### Islands and client directives: nothing changed

The Astro 7 template directives reference still lists exactly `client:load`,
`client:idle`, `client:visible`, `client:media`, `client:only`, custom client
directives, and `server:defer`
(<https://docs.astro.build/en/reference/directives-reference/>). Neither the v6 nor the
v7 upgrade guide has a single entry touching hydration, `client:*`, or `astro-island`.
Ticket 01's conclusions carry over intact.

### Prefetch: still built in, defaults unchanged, and one trap

- `@astrojs/prefetch` is long dead: npm `@astrojs/prefetch@0.4.1`, carrying the
  deprecation "@astrojs/prefetch is deprecated in favor of the builtin prefetch
  option", last touched 2025. Do not install it.
- The built-in `prefetch` config is present and unchanged in Astro 7
  (<https://docs.astro.build/en/guides/prefetch/>): `prefetch: true` or
  `prefetch: { defaultStrategy, prefetchAll }`; four strategies — `hover` (default),
  `tap`, `viewport`, `load`; `data-astro-prefetch[="strategy"|"false"]`; programmatic
  `prefetch()` from `astro:prefetch` with `ignoreSlowConnection`; `eagerness` only
  under `experimental.clientPrerender`.
- **The trap, documented and confirmed in shipped source: `<ClientRouter />` turns
  prefetching on for every link on the page.** Docs: "When you use Astro's
  `<ClientRouter />` on a page, prefetching will also be enabled by default. It sets a
  default configuration of `{ prefetchAll: true }`". Shipped `ClientRouter.astro`:
  `if (!__PREFETCH_DISABLED__) { init({ prefetchAll: true }); }`, where
  `__PREFETCH_DISABLED__` is replaced from `settings.config.prefetch === false`
  (`astro@7.3.5/dist/transitions/vite-plugin-transitions.js`). Opt out with
  `prefetch: false` or `prefetch: { prefetchAll: false }`.
- Astro 6 removed the `with` option of `prefetch()`; the strategy is now automatic —
  `<link rel="prefetch">` where supported, `fetch()` otherwise.
- Browser caveats, documented: Safari has no `<link rel="prefetch">` and falls back to
  `fetch()`, which needs cache headers; Firefox errors `NS_BINDING_ABORTED` without an
  explicit cache header. For a static Cloudflare Pages deploy the platform's `ETag`
  normally covers this.

### Routing changes worth knowing

Astro 6 (<https://docs.astro.build/en/guides/upgrade-to/v6/>):

- `<ViewTransitions />` removed; `handleForms` prop removed; transitions internals
  deprecated (removed in 7) — see §1.
- "Changed: Route pathname normalization" — `Astro.url.pathname` may now be *partially
  decoded*; use `new URL(Astro.request.url).pathname` for the raw form.
- "Changed: endpoints with a file extension cannot be accessed with a trailing slash" —
  `/sitemap.xml/` is gone regardless of `build.trailingSlash`.
- `getStaticPaths()` params must be `string | undefined`; numbers now error.
- `Astro.glob()` removed; legacy content collections removed; `<script>`/`<style>`
  render in definition order; `import.meta.env` values always inlined;
  `i18n.routing.redirectToDefaultLocale` now defaults to `false`.
- (Zod 4 via `astro/zod` is already a recorded hazard in the map.)

Astro 7 (<https://docs.astro.build/en/guides/upgrade-to/v7/>):

- **Vite 8.**
- **The Rust compiler is now the only compiler and is stricter about HTML.** "Unclosed
  tags now produce errors" and "Semantically invalid HTML is no longer auto-corrected …
  The Rust compiler does not attempt to correct your markup and instead passes it
  through as-is". Directly relevant to hand-built window chrome. Also cosmetic CSS
  serialisation differences (named colours may become hex, `url()` quoting may change).
- **`compressHTML` now defaults to `'jsx'`.** "Now, Astro strips whitespace from your
  HTML using JSX rules by default" — `<span>hello</span> <em>world</em>` renders as
  `helloworld`; use `{" "}`. Set `compressHTML: true` for the old behaviour.
- `src/fetch.ts` (or `.js`/`.mjs`/`.mts`) is a **reserved filename** — Advanced
  Routing, stable in 7. It replaces Astro's whole server request pipeline and is
  irrelevant to a static build, but the name is taken. Change with `fetchFile: '...'` or
  disable with `fetchFile: null`.
- Sätteri is the default Markdown processor and `@astrojs/markdown-remark` is no longer
  installed (already a recorded hazard).
- Route caching (`cache`, `routeRules`, `Astro.cache`) stabilised — server-rendered
  responses only.
- `@astrojs/db` removed. `getContainerRenderer()` must now be imported from
  `@astrojs/react/container-renderer`, not the package root.

### One extra hazard this dig turned up, specific to this project

**In `astro dev` only, navigating to a page that contains a `client:only` island makes
the router fully instantiate that page — including the island — a second time, in a
hidden iframe.** `astro@7.3.5/dist/transitions/router.js`,
`prepareForClientOnlyComponents()`, called only under `import.meta.env.DEV`:

```js
if (newDocument.body.querySelector(`astro-island[client='only']`)) {
  const nextPage = document.createElement('iframe');
  nextPage.src = toLocation.href;
  nextPage.style.display = 'none';
  document.body.append(nextPage);
  ...
  await hydrationDone(nextPage);
```

It exists to harvest Vite's dev-only `<style data-vite-dev-id>` tags for client-only
components. For a desktop shell that is one `client:only` island holding a WebGL
context, this means every dev-mode client-side navigation *back* to the shell page
briefly runs two copies of the shell and two contexts. Production builds do not do
this. **This is shipped source, not documented anywhere.**

**Bottom line:** islands and `client:*` are untouched by 6 and 7, and prefetch keeps
all its Astro-5 defaults — but `<ClientRouter />` still silently enables `prefetchAll`,
`<ViewTransitions />` and the transitions internals are gone, and Astro 7's strict Rust
compiler plus `compressHTML: 'jsx'` will change markup that worked before.

---

## What I could not resolve

1. **Whether a persisted `client:only` island's WebGL context actually survives an
   Astro 7 swap.** Structurally it should (the node never disconnects, and
   `moveBefore()` is used where available), and PR #15728 was written for exactly that,
   but there is no docs statement and no WebGL e2e test. *Resolved by:* a throwaway
   Astro 7 project with `<canvas transition:persist>` holding a WebGL2 context,
   navigating between two pages that both emit the persist target, on Chrome,
   Firefox 156, and Safari 27, watching for `webglcontextlost` and checking
   `gl.isContextLost()`. Small, and worth doing before the seam is designed around it.
2. **Whether Astro's reduced-motion CSS ships on a page with `<ClientRouter />` and
   zero `transition:*` directives** (§5). *Resolved by:* `astro build` and grepping the
   emitted CSS for `prefers-reduced-motion`. Cheap.
3. **Whether the canvas is still measurable when the persist target is hidden** — the
   maintainer's "`display: none` or outside the viewport" workaround interacts with
   R3F's resize observer, and I found no source addressing it. *Resolved by:* the same
   throwaway project, with the persist target `display: none` on the content page.
4. **The `position: fixed` snapshot question** (§4) is spec-derivable but not
   spec-*stated*; only a visual test on a real fixed-position element carrying a
   `view-transition-name` settles what it looks like.
