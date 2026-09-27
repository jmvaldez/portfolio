# Performance budget and enforcement

Type: grilling
Status: open
Blocked by: 16

## Question

Put numbers on the build and decide what enforces them. The costs already on the table:

- 237 KB gzip for three + R3F + drei on the shell (ticket 01), lazy behind a gate.
- Content pages at 0 KB JS apart from the inline CRT-preference script (ticket 09).
- **Shell re-entry cost** after a round trip (parse, hydrate, fresh WebGL context,
  restoring the sessionStorage layout). Ticket 09 put this on the critical path and it
  needs a bound.
- The inline boot-gate script in `<head>` on `/`, and the 600 ms first-visit floor on
  time-to-desktop (ticket 10).
- ~50 KB of woff2 on every page, one preloaded (ticket 13).
- Whatever analytics adds (ticket 16).
- The frame budget. Ticket 07 measured only a discrete RTX 3060. Integrated graphics are
  still unmeasured (a hazard), so decide whether the budget needs a real iGPU measurement
  first.

Decide the budgets (bundle sizes per route, LCP/INP/CLS targets per layout, frame-time
targets for the shell), what gates them (Lighthouse CI, a bundle-size check in CI, or
both), and whether a failed gate blocks merges or only warns.
