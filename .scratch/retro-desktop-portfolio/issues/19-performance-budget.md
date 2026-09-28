# Performance budget and enforcement

Type: grilling
Status: resolved
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

## Answer

The captain delegated this ticket ("plan the rest using sensible defaults"). Every call
below is the agent's default. Analytics adds nothing
([Analytics](16-analytics.md) ruled out client analytics), so that line is zero.

### Byte budgets (gzip, measured on `dist/`)

| surface | budget | basis |
|---|---|---|
| content pages: external JS | **0 bytes**: no `<script src>`, no module script | ticket 01's measured 0 KB |
| content pages: inline JS | ≤ 1 KB total | the CRT-preference script (ticket 09) |
| `/`: head gate inline script | ≤ 1.5 KB | ticket 10 |
| `/`: shell island, initial | ≤ 90 KB | React + window manager + terminal, without 3D |
| `/`: 3D lazy chunk | ≤ 250 KB | 237 KB measured + about 5% headroom |
| CSS, any page | ≤ 20 KB | one stylesheet, Tailwind purged |
| fonts, any page | ≤ 60 KB total, exactly one preload | ~50 KB measured (ticket 13) |
| drone SVG (linear layout) | ≤ 15 KB | ticket 11 |
| `resume.pdf` | ≤ 150 KB | subset font embedded |

### Lab vitals (Lighthouse, median of three runs)

- **Content pages and the linear layout**, mobile preset: LCP ≤ 2.0 s, TBT ≤ 50 ms,
  CLS ≤ 0.02. The low CLS is achievable because ticket 13's size-adjusted fallbacks make the
  font swap near-zero-shift. A failure there means the fallback metrics are wrong.
- **`/` with the shell**, desktop preset: LCP ≤ 1.5 s (the boot screen is the LCP element),
  TBT ≤ 200 ms, CLS ≤ 0.05.
- **INP has no lab measurement and no field source**, since analytics is off. TBT is the lab
  proxy, and the INP target is ≤ 200 ms as a design intent only.

### Timing budgets for the shell

- **First visit, time to desktop:** already bounded by ticket 10: floor 600 ms, ceiling 1.5 s,
  never waiting on the 3D chunk.
- **Re-entry after a round trip to a page:** the shell is interactive with its
  `sessionStorage` layout restored within **800 ms** of navigation start, on the reference
  desktop. The 3D may arrive after that, and windows never wait for it.
- **Frames:** p95 frame time ≤ 16.7 ms with the grid plus one `viewer.exe` at the capped DPR,
  and ≤ 33 ms under ticket 07's stress case (five viewers). The **canvas DPR is capped at 1.5**
  (`dpr={[1, 1.5]}`). The scene is wireframe and gains almost nothing above that, and the cap
  is the first lever if integrated graphics fall short.

### The iGPU measurement: before the build commits, not before the map closes

The frame budget stands now. **Measuring it on real integrated graphics is the first check
of the build phase, a manual one**, run the first time the real shell renders. It's run by
hand on a physical iGPU laptop, because headless Chrome on this machine's iGPU wouldn't
render (ticket 07's hazard). If it misses, the fallbacks in order are: DPR cap to 1,
`frameloop="demand"` for the grid while nothing moves, then stopping the viewer's rotation
while its window isn't focused. None of these changes the spec, so the measurement doesn't
block the map.

### Enforcement, in GitHub Actions (per [Resume delivery](15-resume-delivery.md))

- **Blocking (deterministic):** a byte-budget check over `dist/` for every row of the table.
  It includes an HTML assertion that no content page contains an external or module script,
  which is the cheapest guard against an island leaking onto a page.
- **Blocking (Lighthouse CI):** CLS, and the resource-size assertions.
- **Warning only:** LCP and TBT. Timing on shared CI runners is noisy enough that a blocking
  gate would train everyone to rerun it. They're reported on the PR and tracked.
- **Manual, via a PR-template checkbox:** the frame budget, for any PR that touches the 3D
  scene.
