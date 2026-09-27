# Retro Desktop Portfolio

Joe Valdez's software-engineering portfolio, presented as a retro personal computer.
This glossary exists because the site has two vocabularies sitting on top of each other
— a desktop metaphor and an Astro content model — and the same word often means
something in both.

## Language

### The shell

**Desktop shell**:
The landing experience: a simulated desktop rendered as a single client-only React
island. Not the whole site.
_Avoid_: OS, desktop environment, the app

**Window**:
A draggable, resizable panel inside the desktop shell. Floats freely and tiles when
released against an edge or corner.
_Avoid_: modal, dialog, panel, card

**Content window**:
A window holding one entry's rendered body.
_Avoid_: detail window, viewer

**Folder window**:
A window holding a directory's listing rather than a body.
_Avoid_: browser, explorer, finder

**Launcher**:
A taskbar button that opens a root-level mount. Distinct from the button representing
an already-open window.
_Avoid_: shortcut, tab, nav item

**Desktop icon**:
An icon on the desktop surface itself, derived from the same mount table as the
launchers.
_Avoid_: shortcut, tile

**Snap zone**:
A region at an edge or corner of the desktop that tiles a window released into it.
_Avoid_: dock, drop target

**Taskbar**:
The persistent strip at the bottom of the desktop shell. Holds a launcher per
root-level mount and a button per open window.
_Avoid_: dock, navbar, status bar

**Page**:
A real, statically rendered route with its own URL, outside the desktop shell. Where
long-form content is actually read.
_Avoid_: view, screen, route

**Promotion**:
Navigating from a window to the same node's page. The maximise box performs it; a window
is never a preview, so promotion changes the framing and never the content. A window has
a maximise box if and only if its node has a URL.
_Avoid_: maximise to page, expand, open full, pop out

**Linear layout**:
The site rendered with the chrome but without the metaphor: no dragging, no snapping, no
desktop surface. One artifact serving three jobs — the mobile experience, the document
served at `/` for a visitor without the shell, and what a crawler reads.
_Avoid_: mobile view, fallback, responsive layout, no-JS version

### The filesystem

**Filesystem**:
The navigable tree the terminal walks. Assembled at build time; it is a representation
of the content, never a second copy of it.
_Avoid_: VFS, fake FS, file tree

**Node**:
One addressable position in the filesystem. Every node has a path and a kind.
_Avoid_: item, element, file (unless it really is a content node)

**Mount table**:
The declaration that assembles the filesystem: which collection appears at which path,
and what synthetic nodes exist alongside them.
_Avoid_: manifest, registry, config

**Mount**:
One collection attached to a path in the filesystem, expanding automatically into the
nodes its entries imply.
_Avoid_: mapping, binding

**Synthetic node**:
A node with no collection entry behind it — a directory that only groups, an inline
text file, an easter egg.
_Avoid_: virtual node, fake file, stub

### The terminal

**Terminal**:
The toy shell: an app node that opens as a single window. Always an alternate path
through the filesystem, never the only one, and never navigates away from the shell.
_Avoid_: console, CLI, shell (the desktop shell is something else)

**Command**:
A verb the terminal understands. Each one is also a node under `/bin`, so the
commands are discoverable by walking the filesystem.
_Avoid_: program, builtin, script

**Working directory**:
The terminal's current position in the filesystem, shown in the prompt. Moved only by
`cd`; clicking windows never changes it.
_Avoid_: cwd (in prose), location, current folder

**Easter egg**:
A command absent from `help` and present in `/bin`, found by exploring rather than
reading.
_Avoid_: secret, hidden command, cheat

### The content

**Collection**:
An Astro content collection. The source of truth for a body of content.
_Avoid_: model, table, dataset

**Entry**:
One item in a collection, authored as a Markdown file with validated frontmatter.
_Avoid_: document, record, post, item

**Body**:
An entry's prose, authored as plain Markdown. Rendered to HTML at build time and
fetched on demand.
_Avoid_: content, copy, markdown (as a noun for the prose itself)

**Project**:
An entry describing a piece of software work. Carries `type: "project"`.
_Avoid_: case study, work, portfolio item

**Drone build**:
An entry describing one aircraft. A peer of a project, never a kind of project.
Carries `type: "drone"`.
_Avoid_: drone project, build log

**Note**:
A supporting entry nested under a project or a drone build, carrying only a title.
Exists so nesting does not force full frontmatter onto every file.
_Avoid_: sub-page, child, fragment

**Readme**:
The file holding a directory's own content. A directory never carries a body itself.
_Avoid_: index, overview page

**Tech**:
A software project's technology stack.
_Avoid_: stack, technologies

**Hardware**:
A drone build's component stack — motors, ESC, flight controller, VTX, camera.
_Avoid_: stack, parts, components, specs

### The treatment

**CRT treatment**:
The layer of effects that makes the shell read as a phosphor monitor: scanlines and
bloom. Static, never animated, and switchable off as a single unit.
_Avoid_: CRT effect, retro filter, screen effect

**Scanline**:
The horizontal darkening applied to a chrome surface. Per-surface, never a viewport
overlay, and never over long-form body copy.
_Avoid_: scanlines overlay, raster line, CRT lines

**Bloom**:
The glow on lit text, drawn as a `text-shadow`. Never a CSS filter or a blend mode.
_Avoid_: glow, halo, phosphor glow

**Phosphor green**:
The green that carries data and lit text. One of two hues; the other is the amber.
_Avoid_: terminal green, primary green

**Amber**:
The second hue. It carries chrome, numerals, the HUD layer, and the focused window's
border. Never used for body copy.
_Avoid_: orange, accent colour, highlight

**HUD layer**:
The competitive-FPS borrowings: the crosshair and readout inside the viewer, the
kill-feed toasts, and the taskbar gauges. One layer, deliberately thin.
_Avoid_: HUD overlay, game UI, chrome

