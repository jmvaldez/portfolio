# Sourcing the drone model

Type: research
Status: resolved
Blocked by: —

## Question

The `viewer.exe` window holds an orbitable FPV drone rendered low-poly / wireframe to
match the vector-grid world. Where does that model come from?

Survey the three routes and report costs honestly: (a) download or buy a glTF —
what exists on Sketchfab/Poly Haven/Quaternius for FPV quadcopters, under what
licences, at what poly count and file size, and how hard it is to strip to a
flat-shaded or wireframe look; (b) model it in Blender — rough hours for someone who
is not a 3D artist, and the glTF export path; (c) build it procedurally from three.js
primitives — feasibility of a recognisable quad (frame, four arms, props, camera
tilt) from boxes and cylinders, and whether it can be made to look deliberate rather
than cheap.

Include file-size and licence-attribution implications for each. Flag anything that
would force an attribution notice into the UI.

## Answer

**Build the drone procedurally from three.js primitives, and use a bought or CC-BY
model only as visual reference.** A recognisable FPV quad — frame plate, four arms,
four motor bells, prop blades, canopy, tilted camera, two antennas — is **≈388
triangles** of `BoxGeometry` and 8-segment `CylinderGeometry` (computed from three.js's
own constructor defaults). Zero asset bytes, zero licence obligation, and total control
of the topology, which is what the wireframe treatment actually depends on.

**The survey, honestly:**

- **(a) Download free.** There is **no CC0 quadcopter** in the commons. Sketchfab
  returns **0 downloadable CC0 results** for `quadcopter` and for `fpv drone`; its CC0
  `drone` results are building scans and a beetle. Poly Haven has **521 models and no
  drone**. Quaternius has no drone pack and is no longer CC0 (QAL v1.0 now, which bans
  redistributing the asset file). Everything free is **CC-BY**. Best free shapes are on
  poly.pizza (Google Poly archive, **CC BY 3.0**): NateGazzard's quad, **4,564 tris /
  253.6 KB `.glb`** (both measured), and Silly Fear's Phantom-style quad, **2,397 tris /
  223.0 KB**. On Sketchfab (**CC BY 4.0**) the cleanest is SerhiiKo's "Low Poly
  Quadcopter Drone" at 4,946 faces / 3,148 verts / 4 textures. **Sketchfab download file
  sizes are not verifiable without a logged-in session, so none are quoted.**
  **Hazard:** most free "FPV drone" models on Sketchfab post-2022 are kamikaze/combat
  drones or munitions, and one popular one carries Rostec branding baked into its
  textures. Look at every candidate; do not licence-check alone.
- **(a) Buy.** The standout is **Bundem Games, "FPV Drone Low Poly", $5.99**, Sketchfab
  **Standard** licence: a civilian FPV freestyle quad, **4,526 faces / 2,431 verts /
  0 textures / 13 flat-colour materials**, with the `.blend` included. Already
  flat-shaded — nothing to strip. No credit required *(caveat: `sketchfab.com/licenses`
  is bot-blocked; that reading comes from Sketchfab's licence API, not the legal text)*.
- **(b) Blender.** The export path is trivially solved: the glTF 2.0 add-on is bundled
  and enabled by default, and `Materials: Placeholder` + `Images: None` + `glTF Binary
  (.glb)` produces exactly the untextured asset wanted. The *hours* figure is the one
  number I could not verify — my **estimate is 6–12 h** for a non-artist, +3 h for
  separable spinning props. Flagged as a guess. The stronger argument against (b) is
  that its output is the same shape as (c) at several times the cost.
- **(c) Procedural.** Feasible and the recommendation. See above.

**Attribution: nothing is forced into the UI.** CC BY 4.0 §3(a)(2) permits satisfying
attribution "by providing a URI or hyperlink to a resource that includes the required
information"; CC BY 3.0 §4(b) permits "any reasonable manner". A `/credits` page linked
from the taskbar or footer is enough. Three real constraints if a CC-BY model is used:
credit must state that the work was **modified**; the credits page must be reachable on
**mobile** (so a terminal-only `cat /credits` easter egg fails); and it must be a real
page, not a bundle comment.

**Counter-intuitive licence finding worth carrying into the build:** the *paid*
royalty-free route is the riskier one for a public repo. Sketchfab Standard and
Quaternius QAL both forbid redistributing the asset file standalone — which is what
committing a `.glb` to a public repo does. CC-BY explicitly permits redistribution.

**Two technical traps recorded for the WebGL ticket:** `LineBasicMaterial.linewidth`
is ignored by WebGL and WebGPU (always 1 px — it will vanish under scanlines), so use
drei's `<Edges>`, which is built on `LineSegments2` + `LineMaterial` fat lines with an
`EdgesGeometry` angle threshold. And avoid Draco at this scale: its glTF decoder is
**250,876 bytes** versus **29,019** for meshopt, against a model of ~85 KB.

Full research, with every source URL, licence text and measured/computed/estimated tag:
`.scratch/retro-desktop-portfolio/research/03-drone-model-sourcing.md`
