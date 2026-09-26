# Content model and the fake filesystem

Type: grilling
Status: resolved
Blocked by: —

## Question

Design the Astro content-collection tree that both the window UI and the terminal read
from. This is the load-bearing decision of the build: the fake filesystem the terminal
walks *is* the content collection tree, so `ls` and `cat` come nearly free if the shape
is right.

Settle: what collections exist (`projects`, `drones`, `pages`?) and the zod schema for
each; how a collection entry maps to a path the terminal can walk, and what `cat` prints
for an entry whose body is MDX; whether non-content nodes exist in the filesystem (a
fake `/bin`, a `readme.txt`, easter-egg files) and where those are declared; how the
taskbar and window list are derived from the tree rather than hardcoded; and how a
project's detail page relates to its window.

Call `grilling` and `domain-modeling`. Write the resulting vocabulary to `CONTEXT.md`.

## Answer

Supporting research: [Astro 7 content collections](../research/05-astro-content-collections.md),
measured against a real Astro 7.3.5 static build. Vocabulary is in `CONTEXT.md` at the
repo root.

### Markdown, not MDX

Bodies are plain `.md`. This reverses an assumption made while charting, and the reason
is mechanical: `@astrojs/mdx` registers `contentModuleTypes`, so every `.mdx` entry goes
down the deferred-render branch and **never carries `entry.rendered`**, while `.md`
entries hand you `rendered.html` as a plain string at build time. Choosing `.md` deletes
an entire mechanism from the design — no Container API, no second Markdown pipeline, no
experimental surface. What it costs is JSX inside body copy, and the two plausible uses
for that (an image gallery, a footage embed) are better expressed as frontmatter arrays
the layout renders than as components buried in prose.

### Collections

Three: `projects`, `drones`, `pages`. `drones` is a peer of `projects`, not a tag on it
— the schemas genuinely diverge, and drones is first-class in the IA. `pages` holds
about, contact and resume as entries rather than hand-written `.astro` files, which is
what lets `cat about.txt` work with no special-casing in the terminal.

Both collections start populated; `drones` gets real depth first and `projects` starts
thin and grows. The desktop must not look broken holding two entries.

Schemas import `z` from `astro/zod`, **not** from `astro:content` — Astro 6 moved to
Zod 4 and deprecated the re-export, and `.default()` semantics changed with it.

### Nesting, and what it forces

`projects` and `drones` are **infinitely nestable**, like a real directory tree. A
project is normally a directory, not a file.

Two consequences, both load-bearing:

- **A directory's own content lives in `readme.md` inside it**, never `index.md`. The
  glob loader strips a trailing `/index`, so `orbital-mesh/index.md` and a sibling
  `orbital-mesh.md` produce the same id and one silently wins. The readme convention
  kills that collision outright instead of dodging it by hand, keeps a directory purely
  a directory, and lets `cat` on a directory error the way `cat` on a directory should.
- **Every schema is a union discriminated on an explicit `type` field**, because a
  collection's schema applies to every file beneath it and `projects/x/notes.md` cannot
  be made to carry `role`, `tech`, `period` and `status`. `type: "project"` or
  `type: "drone"` carries the full frontmatter; `type: "note"` needs only `title` and an
  optional `summary`. The discriminator is explicit rather than inferred because a
  fallback union quietly revalidates a fat-fingered project as a note, and it then
  vanishes from the listing with no error.

### Schemas

`projects`, `type: "project"`: `title`, `summary`, `role`, `tech` (string array),
`period` (start, and end or "present"), `status` (shipped | archived | wip),
`repo` (url, optional), `live` (url, optional), `cover` (image, optional),
`featured` (boolean, default false), `filename` (optional).

`drones`, `type: "drone"`: `title`, `summary`, `class` (freestyle | cinematic |
long-range | racing | micro), `frame`, `hardware` (motors, ESC, flight controller, VTX,
camera — all optional strings), `weightG` (optional), `propSizeIn` (optional),
`firstFlight` (date, optional), `footage` (array of label + url, optional),
`gallery` (image array, optional), `featured` (boolean, default false),
`filename` (optional).

`type: "note"`, in either collection: `title`, `summary` (optional).

`pages`: `title`, `filename`, `order` (launcher position), `summary` (optional).

No `draft` flag: unfinished work simply isn't committed, and a draft system is machinery
for a problem a portfolio doesn't have. No sort field beyond `featured`: `ls` sorts
alphabetically because that is what `ls` does, `pages` order by `order`, everything else
orders by `featured` then date.

**"stack" is retired as a term.** `tech` for software, `hardware` for drone components.
The word meant two different things and would have been conflated by anything shared.

### The filesystem

A **mount table** assembles it. Five node kinds: `dir`, `file` (a collection entry),
`text` (synthetic inline prose), `app` (opens but isn't content), `link` (download or
`mailto:`). The root:

```
/                 dir
/about.txt        file   pages/about
/projects         mount  projects collection
/drones           mount  drones collection
/resume.pdf       link   download
/contact          file   pages/contact
/readme.txt       text   inline
/bin              dir
```

A `mount` expands automatically into the nodes its entries imply, so adding a drone is
one file and nothing else. The tree builder must **synthesise intermediate directory
nodes** — the glob loader returns flat ids with slashes and no directory concept, and
Astro offers no built-in tree helper.

`/bin` is real: `ls /bin` lists the commands as files and `cat /bin/whoami` prints a
description. It is never mandatory — bare `whoami` still works. What is actually in
there belongs to **Terminal command surface**.

**Filenames show extensions.** A content node is `<id>.md` by default; a `filename`
frontmatter field overrides it, which is how `pages/about` becomes `about.txt`. A
window's title bar shows the filename, so the terminal and the windows agree on what
things are called.

### Where content is rendered

`getCollection()` cannot be called from client code — it is a hard `[ServerOnlyModule]`
build error, with no workaround. The filesystem is therefore built at build time and
serialised; the tree the island receives carries **metadata only**, no bodies.

- **The window holds the full body**, the same content that renders at the entry's real
  URL. One source, two shells. A window showing a summary would mean writing two
  versions of everything, and they would drift.
- **A directory opens a folder window** showing its listing. One component, but it is a
  second window type alongside the content window.
- **Bodies are one static file per entry**, at a path derived from the node path,
  fetched when the window opens, **prefetched on launcher hover** so the open feels
  instant. Not inlined into the landing HTML, which would make every visitor pay for
  prose they may never open; not one bundle, which is fine at four entries and is
  roughly 30 KB gzipped once the content is real.

### Terminal and desktop surfaces

- **`cat` prints the raw Markdown source**, fetched on demand, not a summary and not a
  stripped-down rendering. It costs no library and nothing at load, and printing the
  file rather than a description of the file is the honest version of the metaphor. On
  a synthetic `text` node it prints the whole thing, because those are written for it.
- **The taskbar** holds a launcher per root-level mount plus a button per open window,
  derived from the mount table so adding a mount adds a launcher. Open-windows-only
  would leave someone who closed everything staring at a desktop with no way back in.
- **The desktop has icons**, derived from the same mount table, so the desktop and the
  taskbar cannot disagree. **Visual system** owns how they look.

