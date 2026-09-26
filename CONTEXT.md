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

**Tech**:
A software project's technology stack.
_Avoid_: stack, technologies

**Hardware**:
A drone build's component stack — motors, ESC, flight controller, VTX, camera.
_Avoid_: stack, parts, components, specs
