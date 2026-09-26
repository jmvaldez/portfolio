# Research: sourcing the drone model for `viewer.exe`

Ticket: [`issues/03-drone-model-sourcing.md`](../issues/03-drone-model-sourcing.md)
Branch: `research/drone-model-sourcing`
Date: 2026-09-25

> **Convention note.** The repo had no existing home for research notes when this was
> written (only `.scratch/retro-desktop-portfolio/{map.md,issues/}`). This file introduces
> `.scratch/retro-desktop-portfolio/research/<ticket-number>-<slug>.md`. If a parallel
> research ticket picked somewhere else, normalise.

> **Verification key.** Every number below is tagged:
> **[measured]** — I fetched it (HTTP `Content-Length`, first-party API field, source code).
> **[computed]** — arithmetic from a documented formula, shown.
> **[estimate]** — my judgement, not verified. Treat as a guess.

---

## Headline

There is **no CC0 quadcopter** anywhere in the usual free-asset commons. Sketchfab
returns zero downloadable CC0 results for `quadcopter` and `fpv drone`; Poly Haven
has 521 models and not one drone; Quaternius has no drone pack (and has moved off
CC0 anyway). Every free option is **CC-BY**, which means an attribution obligation
that follows the asset forever.

The cheapest way out of the obligation is $5.99: one Sketchfab Store model
(Bundem Games, "FPV Drone Low Poly", 4,526 tris, **no textures, 13 flat-colour
materials**, `.blend` source included) is an actual FPV freestyle quad — X-frame,
tri-blade props, GoPro-style cam, antennas — sold under Sketchfab Standard, which
carries no credit requirement.

But the honest recommendation is **route (c), procedural three.js primitives**, with
route (a) as the reference photo. A recognisable quad is ~400 triangles of boxes and
cylinders **[computed]**; it ships zero asset bytes, zero licence obligations, and —
critically — it is the only route where a *wireframe* reading looks deliberate rather
than like a mesh-inspector screenshot.

---

## Route (a): download or buy a glTF

### a.1 The CC0 commons has no quadcopter

| Source | Queried | Result |
|---|---|---|
| Sketchfab | `q=quadcopter&downloadable=true&license=cc0` | **0 results** **[measured]** |
| Sketchfab | `q=fpv drone&downloadable=true&license=cc0` | **0 results** **[measured]** |
| Sketchfab | `q=drone&downloadable=true&license=cc0` | 18 results, all photogrammetry scans of buildings plus four scans of a *Rhomborrhina japonica* ("drone beetle"). No aircraft. **[measured]** |
| Poly Haven | full model index, `https://api.polyhaven.com/assets?t=models` | **521 models, zero** matching `drone`/`copter`/`quad` **[measured]** |
| Quaternius | pack index at `https://quaternius.com/` | No drone or quadcopter pack. Vehicles are tanks, cars, trains, ships, spaceships. **[measured]** |
| poly.pizza (CC0 subset) | search `drone` | CC0 hits are Kay Lousberg kit items (a *drill*), not drones. Every actual drone there is CC-BY 3.0. **[measured]** |

Queries run against `https://api.sketchfab.com/v3/search` (Sketchfab's own public
v3 API) and `https://api.polyhaven.com/assets` (Poly Haven's own API).

Poly Haven licence: **CC0**, "You do not need to give credit or attribution when
using them (although it is appreciated)" — <https://polyhaven.com/license>. Moot;
they have no drone.

Quaternius is **no longer CC0**. It is now the Quaternius Asset License (QAL) v1.0 —
<https://quaternius.com/license.html>: free commercial use, **no attribution
required**, but you may not "resell or redistribute the Assets themselves" as
standalone files. Also moot, and see the redistribution flag in a.6.

### a.2 What actually exists, free, CC-BY

**poly.pizza** (the rescued Google Poly archive). Triangle counts and `.glb` byte
sizes below are both **[measured]** — tris from each page's embedded
`__SERVER_APP_STATE__` JSON, bytes from an HTTP `HEAD` on the served
`static.poly.pizza/<uuid>.glb`.

| Model | Author | Tris | `.glb` | Licence | URL |
|---|---|---:|---:|---|---|
| Drone ("Quad-rotor remote drone with underside mounted camera") | NateGazzard | 4,564 | 253.6 KB | CC-BY 3.0 | <https://poly.pizza/m/DNbUoMtG3H> |
| Drone ("Phantom series") | Silly Fear | 2,397 | 223.0 KB | CC-BY 3.0 | <https://poly.pizza/m/3Ae_y67lzvd> |
| Little Drone | Nick Olson | 2,690 | 184.2 KB | CC-BY 3.0 | <https://poly.pizza/m/dJ9mjQQqDQJ> |
| Stinger Drone (sci-fi, not a quad) | Aaron Clifford | 1,132 | 92.7 KB | CC-BY 3.0 | <https://poly.pizza/m/6CUQX98vha4> |
| camera drone (a camera *head*, not a quad) | Christopher Burgess | 1,830 | 144.5 KB | CC-BY 3.0 | <https://poly.pizza/m/fyB_cRYLcUY> |

I looked at the render of each. Only the first two are recognisable quadcopters.
NateGazzard's is a black DJI-ish quad with four arms, tri-blade props on motor bells,
landing skids and a body camera — the best free shape available. Silly Fear's is a
white Phantom-style quad.

Both are **CC BY 3.0** (Google Poly's original terms), *not* 4.0.

**Sketchfab**, free + downloadable + CC Attribution 4.0. Fields below are
**[measured]** from `https://api.sketchfab.com/v3/models/<uid>`. Sketchfab's
`faceCount` is the post-triangulation count. **Download file size is not exposed by
the unauthenticated API** — the `archives` object requires a logged-in session, so
every Sketchfab file size in this document is **unverified and therefore omitted**.

| Model | Author | Faces | Verts | Tex | Mats | Note |
|---|---|---:|---:|---:|---:|---|
| [Low Poly Quadcopter Drone – Game Ready PBR Asset](https://sketchfab.com/3d-models/low-poly-quadcopter-drone-game-ready-pbr-asset-65d0bfcf9c5a479ebb19215a261b8497) | SerhiiKo (@mr-falk) | 4,946 | 3,148 | 4 | 2 | Clean sci-fi quad with ducted props. Best-looking free option. |
| [Low poly QuadCopter Drone](https://sketchfab.com/3d-models/low-poly-quadcopter-drone-fa0261d9db004dda9d4d3ff9bc985717) | GTKima | 5,498 | 2,975 | 9 (4K) | 3 | Carries "Ростех" (Rostec, the Russian state defence conglomerate) branding **baked into the textures**. Avoid. |
| [Low-Poly FPV Drone](https://sketchfab.com/3d-models/low-poly-fpv-drone-d080d91ee43446d29fa6a446664bc4c4) | misha_xok | 8,068 | 4,167 | **0** | 16 | Untextured, flat-colour materials — technically ideal. But it is a *kamikaze* drone with a warhead slung underneath. |
| [FPV-dron_NonStop](https://sketchfab.com/3d-models/fpv-dron-nonstop-c75dea6e3ae441ac87f292efb17f5bae) | Viktor_ | 24,713 | 13,601 | 5 | 1 | The most authentic real FPV build (carbon X-frame, LiPo, whip antenna, cam). Also carries a munition; separable in Blender. |
| [Modern Mini Surveillance Drone](https://sketchfab.com/3d-models/modern-mini-surveillance-drone-a9adf249c419442d97d96c2de15dc29a) | alaaeldeen | 23,462 | 11,910 | **0** | 4 | Untextured. Heavier than needed. |
| [Dron low poly 3d model](https://sketchfab.com/3d-models/dron-low-poly-3d-model-51afcf22d5dc44db937e2cbb0f15e0bf) | ToxaGrom | 1,218 | 631 | 5 | 1 | Ranks top for "quadcopter low poly" but is a fixed-wing loitering munition. Not a quad. |

**A real hazard worth naming.** The post-2022 "FPV drone" corpus on Sketchfab is
overwhelmingly military. Of the 24 most-liked free CC-BY `fpv drone` results, a large
fraction are kamikaze/combat drones, munitions and UAV surveillance rigs. A
recruiter-facing portfolio that renders a loitering munition on its landing page is a
category of own-goal that is hard to walk back. **Any downloaded model must be looked
at, not just licence-checked.**

### a.3 What exists, paid

| Model | Author | Price | Licence | Faces | Verts | Tex | Mats | Source file |
|---|---|---:|---|---:|---:|---:|---:|---|
| [FPV Drone Low Poly](https://sketchfab.com/3d-models/fpv-drone-low-poly-61777f0802ba484d8d19c762d97f75ed) | Bundem Games | **$5.99** (API `price: 599`) | Sketchfab **Standard** | 4,526 | 2,431 | **0** | 13 | `.blend` |

All fields **[measured]** from the Sketchfab v3 model endpoint. This is the standout
commercial option and it is almost perfectly shaped for this brief:

- It is unambiguously an **FPV freestyle quad** — X-frame, four arms, tri-blade props,
  action-cam on top, FPV camera at a forward tilt, two whip antennas. Civilian.
- **Zero textures, 13 materials.** It is already a flat-shaded, colour-per-material
  model. There is nothing to strip.
- The `.blend` ships, so decimation, prop separation and re-export are trivial.
- **No attribution obligation.** Sketchfab's own licence table
  (<https://api.sketchfab.com/v3/licenses>) gives Standard's requirements as
  "Under basic restrictions, use worldwide, on all types of media, commercially or not,
  and in all types of derivative works" — the credit clause present on `by`
  ("Author must be credited") is absent. **Caveat:** `https://sketchfab.com/licenses`
  itself sits behind bot protection and I could not fetch the full legal text; the
  "no attribution" reading rests on the API's requirements string plus secondary
  summaries, not on the licence document. Read it before buying.

Fab (Epic) also lists several low-poly FPV drones. I could not verify prices,
triangle counts or licence tiers — **fab.com returns HTTP 403 to non-browser
clients**. Nothing about Fab in this document is first-hand.

### a.4 Stripping a downloaded model to flat-shaded or wireframe

Easy, and mostly a non-issue — because the best candidates are already untextured.

- **In Blender.** The glTF 2.0 exporter is bundled and **"enabled by default"**
  (Blender manual, `manual/addons/scene_gltf2.rst`,
  <https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html>).
  Two export options do the whole job:
  - `Materials` → `Placeholder` — "Export only the material placeholder, without any
    texture or shader. Primitives are not merged, so material slot information is kept."
    Keeping slots matters: slots become your colour channels.
  - `Images` → `None` — "If None is chosen, materials are exported without textures."
  - `Format` → `glTF Binary (.glb)` — "a single `.glb` file with all mesh data, image
    textures, and related information packed into a single binary file."
  - Draco is available in-exporter (`Data → Draco Compression`) — but see the decoder
    cost in a.5 before reaching for it.
- **CLI, no Blender.** `glTF-Transform` (<https://gltf-transform.dev/cli>) exposes
  `simplify` (reduce vertices), `weld`, `unlit` (convert metal/rough to unlit),
  `palette` (merge materials), `quantize`, `draco`, `meshopt`, and an umbrella
  `optimize`. One command plus a runtime material override is the whole pipeline.
- **At runtime, no offline step at all.** In R3F, traverse the loaded scene and swap
  every `mesh.material` for one `MeshBasicMaterial`/`MeshLambertMaterial` in the
  phosphor green. Cheapest possible strip, and it survives re-downloading the source.
- **`gltfjsx`** (<https://github.com/pmndrs/gltfjsx>) turns a `.glb` into a declarative
  R3F JSX component — "It creates a virtual graph of all objects and materials. Now
  you can easily alter contents and re-use." That is the bridge if you want per-part
  control (spin the props, tilt the cam) over a downloaded asset.

### a.5 File-size implications

Real anchors **[measured]**: 4,564 tris → 253.6 KB `.glb`; 2,397 tris → 223.0 KB
`.glb` (poly.pizza, textures embedded).

Untextured, geometry alone is much smaller. For the Bundem model
(2,431 verts / 4,526 tris), position + normal at `float32` with 16-bit indices:
`2431 × (12 + 12) + 4526 × 3 × 2 = 58,344 + 27,156 ≈ 84 KB`, plus a few KB of JSON
**[computed]**. So expect **roughly 60–120 KB** for any of these once textures are
dropped **[estimate, from that arithmetic]**.

**Do not reach for Draco at this scale.** Decoder payload, from unpkg package
metadata for `three@0.186.0` **[measured]**:

| Decoder | Bytes |
|---|---:|
| `examples/jsm/libs/draco/gltf/draco_decoder.wasm` | 192,420 |
| `examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js` | 58,456 |
| **Draco total** | **250,876** |
| `meshoptimizer@1.3.0/meshopt_decoder.mjs` | 29,019 |

Adding a ~251 KB Draco decoder to save ~60 KB on an ~85 KB model is net negative.
Meshopt at 29 KB is roughly break-even and only worth it if other assets share it.

### a.6 Licence and attribution implications

| Option | Licence | Credit required? | Redistribution inside a public repo? |
|---|---|---|---|
| poly.pizza drones | CC BY 3.0 | **Yes** | Explicitly allowed |
| Sketchfab free drones | CC BY 4.0 | **Yes** | Explicitly allowed |
| Bundem Games, $5.99 | Sketchfab Standard | No (caveat in a.3) | **Arguably not** — Store terms bar redistributing models as standalone assets |
| Quaternius (hypothetical) | QAL v1.0 | No | **No** — "resell or redistribute the Assets themselves" is prohibited |

**The inversion here is worth pausing on.** The paid, "royalty-free" route is the
*less* safe one for a portfolio whose source repo is itself part of the showcase.
Committing a `.glb` bought under Sketchfab Standard (or a QAL asset) into a public
repo puts the raw asset file on a public URL as a standalone download — precisely what
those licences forbid. CC-BY has no such restriction: redistribution is the point and
attribution is the price. If the repo will be public, either buy it and keep the
`.glb` out of version control (fetch at build time from a private store, which breaks
reproducible builds), or use CC-BY and credit properly, or build it yourself.

**Does any of this force an attribution notice into the UI? No.**

- CC BY 4.0 §3(a)(2): "You may satisfy the conditions in Section 3(a)(1) in any
  reasonable manner based on the medium, means, and context in which You Share the
  Licensed Material. For example, it may be reasonable to satisfy the conditions by
  providing a URI or hyperlink to a resource that includes the required information."
  (<https://creativecommons.org/licenses/by/4.0/legalcode.en>)
- CC BY 3.0 §4(b): credit must carry the author's name, the title of the work, and the
  licensor's URI, and "may be implemented in any reasonable manner"; within a
  collection it must be "at least as prominent as the credits for the other
  contributing authors."
  (<https://creativecommons.org/licenses/by/3.0/legalcode.en>)
- Sketchfab's own licence table gives `by` as "Author must be credited. Commercial use
  is allowed." (<https://api.sketchfab.com/v3/licenses>) — no placement is specified.

So a `/credits` page linked from the persistent taskbar or the site footer satisfies
both licences. **Three constraints do bite, though:**

1. CC BY 4.0 §3(a)(1) also requires you to **indicate that you modified the work**.
   Stripping textures and recolouring is a modification; "recoloured and simplified"
   in the credit line covers it.
2. The credits route must exist on **mobile too**. A `cat /credits` easter egg in the
   terminal does not qualify — the terminal is desktop-only per the map, and
   attribution reachable only by discovery is not "reasonable".
3. It must be a real page, not a comment in the JS bundle.

None of that intrudes on the `viewer.exe` chrome. A CC-BY model costs one line on one
page. The "attribution notice forced into the UI" fear is unfounded — but it *is* one
more page that has to exist, be legible, and be maintained.

---

## Route (b): model it in Blender

**The glTF export path is a solved, first-party, zero-friction problem.** The
exporter is bundled and enabled by default; `File → Export → glTF 2.0 (.glb/.gltf)`;
pick `glTF Binary (.glb)`; set `Materials: Placeholder` (or `Viewport` — "Export only
the viewport material (Base Color, Roughness, and Metalness)") and `Images: None`.
No conversion step, no FBX intermediary, no Draco decision to make.
**[measured — Blender manual source, `projects.blender.org/blender/blender-manual`,
`manual/addons/scene_gltf2.rst`]**

**Hours for a non-3D-artist: this is the number I cannot verify.** What I can anchor:
the most-recommended paid Blender drone course runs ~25 hours of real-time video and
covers low-poly *and* high-poly modelling, UV mapping, baking, texturing and
rendering — the full pipeline, most of which this project does not need
(<https://superhivemarket.com/products/blender-drone-tutorial---learn-blender-and-substance-painter>).
Polygon Runway has a free single-video stylised flying-drone tutorial at the other
end of the range.

My **[estimate]**, explicitly a guess: for someone who can drive a 3D viewport but is
not an artist, a flat-shaded quad with no UVs and no textures is **6–12 hours** across
two or three sittings — most of it spent fighting Blender's interface rather than the
geometry. Add ~3 hours if the props must be separate objects with correct origins so
they can spin. The 25-hour figure is the wrong benchmark; it includes everything this
project deliberately skips.

The real argument against route (b) is not the hours. It is that **the output is the
same shape as route (c)**. A flat-shaded box-and-cylinder quad is what you would build
in Blender *and* what you would build in code. Route (b) buys you nicer bevels and
costs you a binary asset, a build step, and a skill you do not currently have.

---

## Route (c): procedural from three.js primitives

**Feasible, and cheap.** Triangle budget computed from three.js's own geometry
constructors **[computed]**:

- `BoxGeometry` defaults to `widthSegments = heightSegments = depthSegments = 1`
  → 6 faces × 2 = **12 triangles** (`three/src/geometries/BoxGeometry.js`, L32).
- `CylinderGeometry` defaults to `radialSegments = 32, heightSegments = 1` — far more
  than needed. At `radialSegments = 8`, capped: sides `8 × 1 × 2 = 16`, caps `8 + 8`
  → **32 triangles** (`three/src/geometries/CylinderGeometry.js`, L34).

A recognisable FPV quad:

| Part | Primitive | Tris |
|---|---|---:|
| Frame plate | 1 box | 12 |
| Arms ×4 | 4 boxes | 48 |
| Motor bells ×4 | 4 cylinders, 8 seg | 128 |
| Prop blades | 8 thin boxes | 96 |
| Canopy | 1 box | 12 |
| FPV camera + lens | 1 box (tilted ~25°) + 1 cylinder, 8 seg | 44 |
| Antennas ×2 | 2 cylinders, 6 seg | 48 |
| **Total** | | **≈ 388** |

**Under 400 triangles, zero asset bytes, zero licence.** An order of magnitude below
every downloadable option, and it renders inside the same frame budget as the vector
grid floor.

**Does it look deliberate or cheap?** Deliberate — but only if three things hold:

1. **The camera tilt carries the silhouette.** An FPV quad is read by the
   forward-and-up canted camera block and the X-splay of the arms. Get those two right
   and boxes are enough; get them wrong and no amount of detail rescues it.
2. **Props must not be four static rectangles.** Spinning blur (two crossed thin boxes
   rotating fast, or a low-opacity ring) is what sells "drone" rather than "toy".
3. **Proportion, not part count.** A 5" freestyle quad is ~220 mm motor-to-motor, with
   ~4 mm carbon arms and a 20×20 stack. Modelling to real proportions in code is free
   and is the single highest-leverage thing available.

What makes this route *better* than a downloaded model, rather than merely acceptable,
is the wireframe question.

---

## Why wireframe changes the calculus

The map commits to "low-poly/wireframe" to match a Commodore vector grid. Wireframe
is not a free post-process — it depends on the topology underneath, and that is where
the routes diverge sharply.

**`material.wireframe = true` and drei's `<Wireframe>` draw every triangle edge**,
including the triangulation diagonal across every quad. drei's `<Wireframe>` is a
barycentric-coordinate shader with `thickness`, `stroke`, `fill`, `fillOpacity`,
`dash` and `squeeze` props (`drei/src/materials/WireframeMaterial.tsx`, L5–L21).
On a 4,500-triangle downloaded model that is **mesh spaghetti** — it reads as a
3D-software screenshot, not as a vector graphic.

**`THREE.EdgesGeometry(geometry, thresholdAngle)`** is the one that gives the clean
vector look: "An edge is only rendered if the angle (in degrees) between the face
normals of the adjoining faces exceeds this value", default `1`
(`three/src/geometries/EdgesGeometry.js`, L31–L34). At ~15–20° you get hard
silhouette edges only.

**Critical gotcha: `LineBasicMaterial.linewidth` does nothing on the web.** From the
three.js source comment: *"Can only be used with `SVGRenderer`. WebGL and WebGPU
ignore this setting and always render line primitives with a width of one pixel."*
(`three/src/materials/LineBasicMaterial.js`, L64–L72). A 1-pixel hairline will vanish
under a CRT/scanline overlay. This is a real trap and would otherwise be discovered
late.

**The fix is drei's `<Edges>`.** It is not a `LineSegments`: its source builds a
`LineSegments2` with `LineSegmentsGeometry` + `LineMaterial` from `three-stdlib` —
instanced *fat* lines with a genuine pixel `lineWidth` — and it extracts
`EdgesGeometry` from its parent mesh via a `threshold` prop (default 15°)
(`drei/src/core/Edges.tsx`, L1–L48; it renders `<Line segments … />`, and
`drei/src/core/Line.tsx`, L1–L36 confirms `Line2`/`LineSegments2` + `LineMaterial`).

So **`<Edges threshold={20} lineWidth={2} color="#33ff66" />` over a flat-shaded dark
mesh is essentially the whole look**, and it works on *any* geometry — downloaded or
procedural.

But it works *better* on procedural geometry, because you authored the topology. A
downloaded 4,500-triangle model was built for PBR shading, not for edge extraction;
its threshold behaviour is whatever the original artist's smoothing groups happen to
produce, and tuning that is an afternoon of trial and error with no guarantee. A
box-and-cylinder quad has exactly the edges you put there.

---

## Route (d): the one the ticket did not name — reference, not asset

Buy the $5.99 Bundem model (or just work from its render), take proportions off it,
and **build the primitives version in code from those measurements**. Copyright does
not cover the proportions of a real-world object. You get the shape discipline of a
real FPV build with none of the licence surface, none of the asset bytes, and full
control of the topology for `<Edges>`.

This is the recommendation.

---

## Recommendation

**Build it procedurally (route c), using a purchased or CC-BY model only as on-screen
reference while you author it (route d).**

| | (a) download free | (a) buy $5.99 | (b) Blender | (c) procedural |
|---|---|---|---|---|
| Bytes shipped | ~60–250 KB | ~60–120 KB | ~60–120 KB | **0** |
| Triangles | 2.4k–25k | 4.5k | ~1–3k | **~400** |
| Licence obligation | credits page + "modified" notice | none, but public-repo redistribution risk | none | **none** |
| Wireframe topology control | poor | fair (`.blend` ships) | good | **total** |
| Time **[estimate]** | ~1–2 h | ~2 h | 6–12 h | ~4–8 h |
| Risk of looking cheap | low | low | medium | **medium — mitigated by proportion, camera tilt, spinning props** |
| Risk of shipping a munition | **real** | low | none | none |

Route (c) is not the cheapest in hours; it is the cheapest in *everything else*, and
it is the only route where the wireframe treatment the map has already committed to is
guaranteed to land. It also removes a page from the build (`/credits`) and a binary
from the repo.

**Fallback, in order, if the procedural quad does not read as a drone after one
prototype session:**

1. Buy the Bundem Games model ($5.99, no attribution, `.blend` source, already
   untextured) and keep the `.glb` out of version control if the repo is public.
2. Use NateGazzard's poly.pizza drone (4,564 tris, 253.6 KB, CC BY 3.0) and add a
   `/credits` page. It is the best free *shape* available.

Do **not** take a free Sketchfab "FPV drone" without looking at it first.

---

## Open questions

- **Sketchfab Standard licence full text.** `https://sketchfab.com/licenses` and
  `https://sketchfab.com/developers/download-api/guidelines` both return bot-blocked
  or empty responses to non-browser clients. The "no attribution required" reading
  rests on the API's requirements string. *Resolved by:* opening
  `sketchfab.com/licenses` in a browser before purchase.
- **Sketchfab download file sizes.** The v3 API's `archives` object needs an
  authenticated session, so every Sketchfab byte figure is absent here rather than
  estimated. *Resolved by:* logging in and reading the download dialog — which also
  surfaces the copy-paste attribution string.
- **Fab (Epic) inventory.** `fab.com` returns 403 to non-browser clients; nothing
  there is verified. *Resolved by:* a browser visit, if the options above prove
  insufficient.
- **Blender hours.** The 6–12 h figure is a guess with no measurement behind it.
  *Resolved by:* timeboxing one 2-hour Blender session and extrapolating — but this
  only matters if route (c) is rejected.
- **Whether ~400 procedural triangles actually read as an FPV quad at
  `viewer.exe`-window scale.** The only genuine unknown in the recommendation, and
  exactly what a throwaway prototype answers in an hour. *Resolved by:* folding it
  into the `07-webgl-scene-composition` prototype rather than deciding it on paper.

---

## Sources

Primary and first-party, all fetched 2026-09-25:

- Sketchfab v3 search API — <https://api.sketchfab.com/v3/search>
- Sketchfab v3 model API — `https://api.sketchfab.com/v3/models/<uid>`
- Sketchfab v3 licence table — <https://api.sketchfab.com/v3/licenses>
- Poly Haven asset API — <https://api.polyhaven.com/assets?t=models>
- Poly Haven licence — <https://polyhaven.com/license>
- Quaternius licence, QAL v1.0 — <https://quaternius.com/license.html>
- poly.pizza model pages (embedded `__SERVER_APP_STATE__`) plus `HEAD` requests
  against `static.poly.pizza/<uuid>.glb`
- Blender manual source — <https://projects.blender.org/blender/blender-manual/src/branch/main/manual/addons/scene_gltf2.rst>
  (rendered at <https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html>)
- three.js source, `dev` branch, via `raw.githubusercontent.com/mrdoob/three.js/dev/src/` —
  `geometries/BoxGeometry.js`, `geometries/CylinderGeometry.js`,
  `geometries/EdgesGeometry.js`, `materials/LineBasicMaterial.js`
- drei source, `master` branch, via `raw.githubusercontent.com/pmndrs/drei/master/src/` —
  `core/Edges.tsx`, `core/Line.tsx`, `materials/WireframeMaterial.tsx`
- glTF-Transform CLI reference — <https://gltf-transform.dev/cli>
- gltfjsx — <https://github.com/pmndrs/gltfjsx>
- CC BY 4.0 legal code — <https://creativecommons.org/licenses/by/4.0/legalcode.en>
- CC BY 3.0 legal code — <https://creativecommons.org/licenses/by/3.0/legalcode.en>
- unpkg package metadata for `three@0.186.0` and `meshoptimizer@1.3.0` (decoder byte sizes)
