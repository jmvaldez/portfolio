# Research: Astro 7 content collections as the terminal's filesystem

Informs ticket `.scratch/retro-desktop-portfolio/issues/05-content-model.md` and,
downstream, `08-terminal-command-surface.md`.
Date: 2026-09-26.

Every behavioural claim below was either verified against a real Astro 7.3.5 static
build in a throwaway sandbox (see [Measurement method](#measurement-method)) or read
out of the shipped source of the package named. Bundle numbers are measured, not
estimated. Where I could not confirm something I say so rather than guessing.

## Versions this was measured against

| package | version | notes |
| --- | --- | --- |
| `astro` | **7.3.5** (2026-09-24) | current latest; this is the "current minor", 7.3 |
| `@astrojs/mdx` | 8.0.2 | now a Rust MDX compiler (`mdxjs-rs:oxc`) |
| `@astrojs/react` | 7.0.0 | |
| `@astrojs/markdown-satteri` | 0.4.2 | pulled in by `astro` itself |
| `vite` | 8.3.1 | |
| `zod` | 4.6.5 | astro depends on `zod@^4.5.4`, imports `zod/v4` |
| `react` / `react-dom` | 19.3.0 | |

Release timeline (`npm view astro time`): 5.0.0 2024-12-03, 5.10.0 2025-06-19,
5.17.0 2026-01-29, 5.18.0 2026-02-25, **6.0.0 2026-03-10**, **7.0.0 2026-06-22**,
7.1.0 2026-07-16, 7.2.0 2026-08-06, 7.3.0 2026-09-03, 7.3.5 2026-09-24.

---

## Headline answers

1. **The Content Layer API is essentially unchanged since Astro 5.** `src/content.config.ts`,
   `defineCollection`, `glob()`/`file()`/custom loaders, `getCollection()`, `render()`.
   If you know the Astro 5 API you know the Astro 7 API.
2. **`astro:content` still cannot be imported from client code.** It is a hard build
   error, not a warning. Confirmed by reproduction.
3. **Three things genuinely changed and they will bite you:** Zod 3 → Zod 4 (Astro 6),
   remark/rehype → Sätteri as the default Markdown processor (Astro 7), and the legacy
   pre-Content-Layer API is fully removed (Astro 6).
4. **`entry.body` (raw MDX source) is available at build time and is free.** But
   `entry.rendered` is `undefined` for **every** `.mdx` entry — MDX is always
   deferred-render. `.md` entries *do* carry `rendered.html` in the store. This is the
   single most design-relevant discovery in this document.
5. **For question 8, slotting Astro-rendered MDX into a `client:only` React island
   works.** I verified it in a real headless Chrome. The suspected limitation does not
   exist in 7.3.5. But it is a fixed, build-time set of bodies, all shipped in the
   landing page's HTML.
6. **Live content collections are stable but irrelevant to you** — they require a
   server adapter. Your expectation was correct.

---

## 1. The current content collections API

### Where collections are defined

`src/content.config.*`, resolved by `searchConfig()` in
`node_modules/astro/dist/content/utils.js:562-570`, which probes, in order:

```
content.config.mjs
content.config.js
content.config.mts
content.config.ts
```

relative to `srcDir` (so `src/`, not the project root).

The legacy location `src/content/config.*` is probed separately
(`utils.js:571-579`) **only to throw a better error**: if it exists and
`legacy.collectionsBackwardsCompat` is not set, Astro raises
`LegacyContentConfigError` (`utils.js:524-535`). Astro 6 removed the old API; see
section 6.

`src/live.config.*` is a *separate* file for live collections (`utils.js:580-583`).

### The loader model

Unchanged from Astro 5. `defineCollection({ loader, schema })`, where `loader` is
either a `glob()`/`file()` built-in from `astro/loaders`, a custom object loader, or an
inline async function.

`glob()`'s full option set, from the shipped
`node_modules/astro/dist/content/loaders/glob.d.ts`:

```ts
interface GlobOptions {
  pattern: string | Array<string>;
  base?: string | URL;
  generateId?: (options: GenerateIdOptions) => string;
  retainBody?: boolean;   // default true  (since 5.17.0)
  deferRender?: boolean;  // default false (since 7.1.0)
}
```

`retainBody` and `deferRender` matter to you and are covered in section 5.

For this project the shape is:

```ts
// src/content.config.ts
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';          // <- see section 6, not from 'astro:content'
import { glob } from 'astro/loaders';

const projects = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/projects' }),
  schema: z.object({ title: z.string(), order: z.number().default(0) }),
});

export const collections = { projects };
```

### The exact shape of what `getCollection()` returns

Measured, not quoted. This is the real `Object.keys()` of an `.mdx` entry in a built
static site:

```
["body", "collection", "data", "deferredRender", "digest", "filePath", "id"]
```

and of a `.md` entry:

```
["body", "collection", "data", "digest", "filePath", "id", "rendered"]
```

| property | type | notes |
| --- | --- | --- |
| `id` | `string` | the key. Slugified. See below. |
| `collection` | `string` | collection name |
| `data` | schema output | parsed + validated frontmatter |
| `body` | `string \| undefined` | **raw source with frontmatter stripped** |
| `filePath` | `string \| undefined` | repo-relative, local entries only |
| `digest` | `string \| undefined` | **new in Astro 7.2.0** |
| `rendered` | `RenderedContent \| undefined` | `.md` only in practice — see section 5 |
| `deferredRender` | `true \| undefined` | internal-ish; `true` for all `.mdx` |

`digest` is new: *"Adds the optional `digest` property to content collection entries.
Loaders can provide an opaque digest value that changes when an entry changes."*
(astro CHANGELOG, 7.2.0, PR #17084). It is a cheap cache key if you ever generate
derived artefacts per entry.

### Is the key still `id`? Yes — and `slug` is gone as a property

`slug` was removed as an entry property in 5.0 and has **not** come back. My dump
checked `'slug' in entry` for every entry: `false` in all cases.

`slug` still exists in exactly one place: as a *frontmatter field* that overrides the
generated `id`. From `generateIdDefault` in `glob.js:11-14`:

```js
function generateIdDefault({ entry, base, data }, isLegacy) {
  if (data.slug) {
    return String(data.slug);
  }
  ...
```

Docs agree: *"You can override a single entry's generated `id` by adding your own
`slug` property to the file frontmatter... This is similar to the 'permalink' feature
of other web frameworks."* — content-collections guide, "Defining custom IDs".

### How `glob()` derives `id` from the file path

`generateIdDefault` delegates to `getContentEntryIdAndSlug`
(`node_modules/astro/dist/content/utils.js:264-278`) and returns the **slug**, not the
raw relative path. The one line that does all the work is `utils.js:277`:

```js
const slug = rawSlugSegments.map((segment) => githubSlug(segment)).join("/").replace(/\/index$/, "");
```

So, precisely: strip the extension, split on the path separator, run **each segment
independently** through `github-slugger`, rejoin with `/`, then strip a trailing
`/index`.

Measured against real files (these are the actual route names Astro emitted):

| file (under the glob `base`) | resulting `id` |
| --- | --- |
| `orbital-mesh.mdx` | `orbital-mesh` |
| `deep/nested/Deep Thing.mdx` | `deep/nested/deep-thing` |
| `deep/index.mdx` | `deep` |
| `UPPER-Case_Name.mdx` | `upper-case_name` |

Four things worth internalising for the filesystem model:

- **Nested directories are preserved as `/`-joined segments.** The `id` *is* a path.
  This is what makes the "collection as filesystem" idea work at all.
- **`index.mdx` collapses to its parent directory.** `deep/index.mdx` → `deep`, not
  `deep/index`. So a directory node and a file node **can collide in the id space**:
  `deep/index.mdx` and `deep.mdx` both produce the id `deep`. Astro treats that as a
  duplicate and applies `prerenderConflictBehavior` (`glob.js:106-125`, raising
  `DuplicateContentEntrySlugError`). Pick one convention in ticket 05 and enforce it.
- **Case is folded and spaces become hyphens**, per segment. `_` survives;
  `UPPER-Case_Name` → `upper-case_name`. A terminal that echoes filenames should echo
  `id` segments, not the on-disk names, or `ls` and `cd` will disagree.
- Docs confirm: *"A unique ID. Note that all IDs from Astro's built-in `glob()` loader
  are slugified."* — `CollectionEntry.id` reference.

### Can `generateId` be customised? Yes

Documented and typed. `generateId?: (options: GenerateIdOptions) => string` where
`GenerateIdOptions` is `{ entry: string; base: URL; data: Record<string, unknown> }`
(`glob.d.ts`). `glob.js:50` shows the user function fully replaces the default:

```js
const userGenerateId = globOptions?.generateId ?? ((opts) => generateIdDefault(opts, isLegacy));
```

Note the consequence: **if you supply `generateId`, the `slug` frontmatter override
stops working**, because the `data.slug` check lives inside `generateIdDefault`, which
you have replaced. If you want both, re-implement the check.

Docs: *"By default it uses `github-slugger` to generate a slug with kebab-cased
words."* — content loader reference, `generateId()`.

**Recommendation for ticket 05:** keep the default `generateId`. Its output is already
exactly a POSIX-ish path, which is what the terminal wants. If you want to preserve
literal on-disk casing for display purposes, store a `label` in frontmatter rather than
fighting the id generator.

---

## 2. Rendering

**Unchanged since Astro 5.0.** It is exactly what you wrote:

```astro
---
import { getEntry, render } from 'astro:content';
const entry = await getEntry('projects', 'orbital-mesh');
const { Content, headings, remarkPluginFrontmatter } = await render(entry);
---
<Content />
```

The reference page tags `render()` with `Since v5.0.0` and lists precisely three
return properties. I confirmed the runtime returns exactly those three keys and no
others — `Object.keys(await render(entry)).sort()` gave
`["Content", "headings", "remarkPluginFrontmatter"]`.

The implementation is `node_modules/astro/dist/content/runtime.js:415-440`:

```js
return {
  Content,
  headings: entry?.rendered?.metadata?.headings ?? [],
  remarkPluginFrontmatter: entry?.rendered?.metadata?.frontmatter ?? {}
};
```

### What you get

- **`Content`** — an Astro component factory. **Not a React component.** This is the
  crux of question 8.
- **`headings`** — measured output for a real entry:
  ```json
  [{ "depth": 1, "slug": "orbital-mesh", "text": "Orbital Mesh" },
   { "depth": 2, "slug": "section-two", "text": "Section Two" }]
  ```
  `depth`/`slug`/`text`. Astro generates the heading `id` attributes itself; I verified
  `<h1 id="orbital-mesh">` in the built HTML. This is a ready-made table of contents
  and, for the terminal, a plausible basis for something like `grep` or a `head`-style
  summary without parsing anything.
- **`remarkPluginFrontmatter`** — measured as `{"title":"Orbital Mesh","order":1}`, i.e.
  the raw frontmatter plus whatever a processor plugin injected. **Note the name is
  now a misnomer**: in Astro 7 the default processor is Sätteri, not remark, but the
  property kept its name. Docs still describe it as *"The modified frontmatter object
  after any Markdown processor plugins have been applied"* — note "Markdown processor",
  not "remark".

### Reading time

Not built in, and the recipe changed in Astro 7. The official
[Add reading time](https://docs.astro.build/en/recipes/reading-time/) recipe now offers
two variants; the default one asks you to install `reading-time`,
`@astrojs/markdown-satteri` and `satteri` and write a **Sätteri mdast plugin**. The old
remark-plugin recipe is still available if you switch the processor back to `unified()`.
Either way the value surfaces through `remarkPluginFrontmatter`.

**If ticket 05 wants reading time, budget for writing a Sätteri mdast plugin, not for
copying a remark snippet off the internet.**

---

## 3. THE CRITICAL ONE: getting collection data into a `client:only` island

### `getCollection()` cannot be called from client-side code. Confirmed.

Stated plainly, because you asked for it plainly: **no, it cannot, and this has not
changed in Astro 7.** `astro:content` is a build-time/server module. There is no
client build of it, no partial client build, and no escape hatch.

This is not a lint rule or a runtime warning — it is a **hard build failure**.
Reproduced: I added a `client:only="react"` component whose first line was
`import { getCollection } from "astro:content"`. `astro build` died with:

```
[ServerOnlyModule] The "astro:content" module is only available server-side.
  Error reference:
    https://docs.astro.build/en/reference/errors/server-only-module/
  Location:
    node_modules/astro/dist/content/vite-plugin-content-virtual-mod.js:339:11
```

The source is unambiguous — `vite-plugin-content-virtual-mod.js:337-342`:

```js
if (isClient) {
  throw new AstroError({
    ...AstroErrorData.ServerOnlyModule,
    message: AstroErrorData.ServerOnlyModule.message("astro:content")
  });
}
```

The good news is you cannot get this wrong by accident: it fails the build, loudly,
with a correct error message. It will never silently ship a broken bundle.

### The three supported ways to bridge the gap

All three work in a fully static build. I built and measured all three.

#### (a) Serialised props from an `.astro` page

```astro
---
const entries = await getCollection('projects');
const tree = entries.map((e) => ({ id: e.id, title: e.data.title }));
---
<Desktop client:only="react" entries={tree} />
```

**What actually ships:** the props are serialised into a `props="..."` attribute on the
`<astro-island>` element, HTML-escaped, in the page's HTML. Measured, from the built
`dist/index.html`:

```html
<astro-island uid="Z1KgKS9" component-url="/_astro/Desktop.CaeDwXyK.js" ...
  props="{&quot;entries&quot;:[1,[[0,{&quot;id&quot;:[0,&quot;deep&quot;],&quot;title&quot;:[0,&quot;Deep Index&quot;]}], ...]]}"
  ssr client="only" opts="{&quot;name&quot;:&quot;Desktop&quot;,&quot;value&quot;:&quot;react&quot;}"></astro-island>
```

Note the `[0, value]` / `[1, array]` tuple encoding — that is Astro's type-preserving
serialiser (it round-trips `Date`, `Map`, `Set`, `RegExp`, `URL`, `BigInt`, typed
arrays; the decoder table is inlined in every island page).

- **When is it fetched?** Never separately. It is *in* the HTML document, so it arrives
  with the first byte of the page. Zero extra requests.
- **Cost:** it inflates the HTML of every page carrying the island, and it is paid
  whether or not the island ever uses it. It is also not cacheable independently of
  the page.
- **Only JSON-serialisable values.** Functions cannot cross the boundary.
- **Best for:** the filesystem *tree* (ids, titles, types, ordering). That is small,
  needed immediately at boot, and needed on every visit. This is the right home for
  `ls`/`cd` data.

#### (b) A static JSON endpoint built from a collection

```ts
// src/pages/fs.json.ts
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const entries = await getCollection('projects');
  return new Response(JSON.stringify(entries.map((e) => ({ id: e.id, title: e.data.title }))),
    { headers: { 'Content-Type': 'application/json' } });
};
```

Verified: this builds to a **plain static file** at `dist/fs.json` and appears in the
build log as a generated route (`├─ /dump.json (+8ms)`). There is no server involved.
It is a flat file Cloudflare Pages will serve from the edge.

- **When is it fetched?** Only when the island calls `fetch('/fs.json')`. One extra
  HTTP request, at whatever moment you choose. Independently cacheable, and it does not
  weigh down the HTML of any page.

**Does `prerender` matter when `output` is static?** **No — and setting it will break
your build.** In static output every route is prerendered by default, so
`export const prerender = true` is a no-op you can omit. Setting
`export const prerender = false` without an adapter is a build error; reproduced:

```
[NoAdapterInstalled] Cannot use server-rendered pages without an adapter.
  Location: node_modules/astro/dist/core/build/index.js:89:13
```

So: **omit `prerender` entirely.** The only reason to think about it is if the site
later gains a Cloudflare adapter, at which point `prerender = true` becomes meaningful
insurance.

#### (c) Importing a generated JSON file directly into client code

```tsx
import tree from './fs-tree.generated.json';
```

Verified: Rollup **inlines the JSON as a JS literal into the island chunk**. The entire
emitted `JsonIsland` chunk was:

```js
import{t as e}from"./jsx-runtime.Bcxxf2w9.js";var t=[{id:`orbital-mesh`,title:`Orbital Mesh`},{id:`deep/nested/deep-thing`,title:`Deep Thing`}],n=e();function r(){return(0,n.jsx)(`ul`,{children:t.map(e=>(0,n.jsx)(`li`,{children:e.id},e.id))})}export{r as default};
```

No separate `.json` was emitted to `dist/` for it. Confirmed by `find dist -name "*.json"`,
which listed only the endpoint-generated files.

- **When is it fetched?** With the island's JS chunk. No extra request, but also no way
  to avoid it once the island loads — it is in the module graph and only tree-shaken at
  property granularity, not per entry.
- **The catch:** something has to *generate* that file, and it cannot be
  `getCollection()` (server-only). You would need a prebuild script that reads
  `src/content/**` itself, duplicating Astro's id-slugification logic. **I would not do
  this.** It creates a second source of truth for ids that can silently drift from
  Astro's. Prefer (a) or (b).

### Recommendation for the desktop shell

Split by access pattern:

- **Tree metadata** (ids, titles, icons, ordering, window geometry) → **(a) props**.
  Small, needed at boot, needed every visit.
- **Bodies / anything large or rarely opened** → **(b) a static JSON endpoint**,
  fetched lazily when a window is actually opened. See section 8.

---

## 4. Live content collections — your expectation is correct

**They are stable in Astro 7, and they are irrelevant to this site.** Confirmed, not
corrected.

- **Stable, not experimental.** There is no `experimental.liveContentCollections` flag
  in Astro 7's config types; `defineLiveCollection`, `getLiveCollection` and
  `getLiveEntry` are plain documented exports of `astro:content`, and the v7 upgrade
  guide's list of removed experimental flags does not mention them. They ship in core:
  `node_modules/astro/dist/virtual-modules/live-config.d.ts` exports
  `defineLiveCollection` unguarded.
- **What they do:** fetch collection data *at request time* from a remote source via a
  custom "live loader", using an API deliberately parallel to the build-time one.
  Config lives in `src/live.config.*`, separate from `src/content.config.*`
  (`utils.js:580-583`).
- **They require a server adapter, full stop.** The docs are explicit:
  *"Additionally, you must have an adapter configured for on-demand rendering of live
  collection data."* — content-collections guide, "Live content collections".

And even if you had an adapter, three of the four documented limitations would kill
this use case outright:

> - **No MDX support**: MDX cannot be rendered at runtime
> - **No image optimization**: Images cannot be processed at runtime
> - **Performance considerations**: Data is fetched on each request (unless cached)
> - **No data store persistence**: Data is not saved to the content layer data store

— content-collections guide, "Types of collections".

Your content is local MDX with images. Live collections cannot render MDX and cannot
optimise images. **Do not spend any further design time on them.**

---

## 5. MDX bodies: is the raw source available, and what does it cost?

### Yes, `entry.body` is the raw markdown source, and it is there by default

Measured. For `src/content/projects/orbital-mesh.mdx`, `entry.body` was exactly:

```
# Orbital Mesh\n\nSome **bold** text and a [link](https://example.com).\n\n## Section Two\n\nMore prose here.
```

Note: **frontmatter is stripped**, the rest is byte-identical to the file. This is
precisely what a `cat` command wants to print.

Docs: *"A string containing the raw, uncompiled body of the Markdown or MDX document."*
— `CollectionEntry.body`.

### It is build-time only, and it does NOT auto-ship

`body` lives in the content layer data store on the build machine. It reaches the
browser **only if you explicitly serialise it** into props or an endpoint. My island
received `[{id, title}]` because that is what I mapped; `body` appeared nowhere in
`dist/index.html`. There is no implicit leak. You are fully in control.

### `retainBody: false` — the lever if you ever need it

```ts
glob({ pattern: '**/*.mdx', base: './src/content/projects', retainBody: false })
```

`glob.js:148` shows the mechanism: `body: globOptions.retainBody === false ? void 0 : body`.
Default is `true` (`Since v5.17.0`).

Docs are pointed about MDX specifically: *"For MDX collections, this will dramatically
reduce the size of the collection, as there will no longer be any body retained in the
store."*

**Do not set this to `false` for a collection whose bodies `cat` needs.** But note it
exists — if you add a large collection the terminal never `cat`s, turning it off shrinks
the store.

### The discovery that changes the design: `.mdx` never has `rendered`

This is the most important empirical finding in this document, and it is not obvious
from the docs.

**Measured**, same build, two collections:

| | `.mdx` entry | `.md` entry |
| --- | --- | --- |
| `entry.body` | present (raw source) | present (raw source) |
| `entry.rendered` | **`undefined`** | present |
| `entry.rendered.html` | **`undefined`** | `"<h1 id=\"note-one\">Note One</h1>..."` |
| `entry.rendered.metadata` | — | `{headings, localImagePaths, remoteImagePaths, frontmatter, imagePaths}` |
| `entry.deferredRender` | **`true`** | `undefined` |

The cause is one line, `glob.js:155`:

```js
} else if (entryType.getRenderFunction && globOptions.deferRender || "contentModuleTypes" in entryType) {
```

`@astrojs/mdx` registers a `contentModuleTypes` property on its entry type
(`node_modules/@astrojs/mdx/dist/index.js:41`), so **every `.mdx` entry takes the
deferred branch unconditionally**, regardless of any option you pass. Instead of HTML,
the store records `deferredRender: true`, and `.astro/content-modules.mjs` gets a lazy
import:

```js
export default new Map([
["src/content/projects/orbital-mesh.mdx", () => import("astro:content-layer-deferred-module?...")],
...]);
```

`render()` then follows the `entry.deferredRender` path at `runtime.js:420-432` and
dynamically imports the compiled Astro component.

The docs corroborate this obliquely — `deferRender`'s description says it makes Markdown
use *"the same on-demand rendering path that `.mdx` files already use"*, and
*"This option does not apply to MDX, Markdoc, and data entries"*.

**Consequences for ticket 05, stated plainly:**

- You **cannot** get an HTML string for an MDX entry by reading `entry.rendered.html`.
  It will be `undefined`. Any design that assumes "I'll just pull the HTML out of
  `getCollection()`" is wrong for MDX.
- `render()` gives you an **Astro component**, not a string.
- **If a collection's bodies never need JSX components, authoring them as `.md`
  instead of `.mdx` hands you `entry.rendered.html` as a plain string for free**, with
  headings metadata attached, no extra machinery. For a terminal that wants to push
  HTML into a window, this is a materially simpler world. See section 8.

### Bundle cost of shipping bodies

There is no magic here: raw markdown is text, and text compresses. My four toy entries
rendered to HTML totalled 957 B raw / **431 B gzip** as a single JSON file. Real project
write-ups will be 2-10 KB gzip each.

The decision is not "is a body expensive" (it is not) but **"do all N bodies ship on the
landing page, or only the one the user opened"**. That is section 8.

---

## 6. What actually changed versus Astro 5/6

The Content Layer API surface itself is stable. What changed is everything *around* it.

### Astro 6.0 (2026-03-10)

**Zod 3 to Zod 4.** The biggest one for schema authors.

> *"Astro v6.0 upgrades to Zod 4, a major dependency update that may require changes to
> custom Zod schemas in your project."* — v6 upgrade guide.

Confirmed in the installed tree: `astro` depends on `zod@^4.5.4` (resolved 4.6.5) and
`node_modules/astro/dist/content/runtime.js:2` reads `import * as z from "zod/v4"`.

Things the upgrade guide calls out that a portfolio schema plausibly hits:

- `z.string().email()`, `z.string().url()` etc. are deprecated; use top-level `z.email()`,
  `z.url()`.
- `.default()` semantics changed: *"In Zod 4, default values must match the output type
  (after transforms), not the input type."*
- `errorsMap` is gone; error customisation changed.
- A [community codemod](https://github.com/nicoespeon/zod-v3-to-v4) exists.

**`z` from `astro:content` is deprecated**, in favour of `astro/zod`:

```ts
// deprecated (still works in 7.3.5 -- I built with it, no warning emitted)
import { defineCollection, z } from 'astro:content';
// preferred
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
```

`astro:schema` is likewise deprecated in favour of `astro/zod` (v6 upgrade guide,
"Deprecated: `astro:schema` and `z` from `astro:content`", PR #14923). There is now a
dedicated [`astro/zod` reference page](https://docs.astro.build/en/reference/modules/astro-zod/):
*"The `astro/zod` module exposes a re-export of Zod that gives you access to all the
features of Zod v4. By using this module, you do not need to install Zod yourself."*

**Write new code as `import { z } from 'astro/zod'`.** Costs nothing now, avoids a
migration later.

**Legacy content collections fully removed.** The pre-Content-Layer API, the
`legacy.collections` flag, *and* the un-flagged backwards compatibility Astro 5 quietly
kept, are all gone. *"No backwards compatibility support is available."* (v6 upgrade
guide, PR #14407). A temporary `legacy.collectionsBackwardsCompat` flag exists as a
migration helper only. Greenfield: irrelevant — but it means every tutorial or Stack
Overflow answer using `type: 'content'`, `src/content/config.ts`, or `entry.slug` is
now actively wrong.

### Astro 7.0 (2026-06-22)

**Sätteri replaces remark/rehype as the default Markdown processor.** The change most
likely to surprise you. It is not a content-collections change per se — it is a
Markdown-pipeline change that content collections inherit.

> *"Astro now renders your `.md` and `.mdx` files with [Sätteri](https://satteri.bruits.org/),
> its native Markdown pipeline, instead of the remark/rehype pipeline. As a result,
> `@astrojs/markdown-remark` is no longer installed by default."*
> — v7 upgrade guide, PR #16966.

Confirmed: `astro@7.3.5` depends on `@astrojs/markdown-satteri@0.4.2` and does *not*
depend on `@astrojs/markdown-remark`.

- **If you use no plugins, nothing changes.** *"Sätteri... applies GitHub-Flavored
  Markdown and SmartyPants just like before."* Verified: GFM and heading ids both
  present in my build output with zero configuration.
- **If you want plugins, you write Sätteri mdast/hast plugins**, not remark/rehype ones.
- **Escape hatch:** install `@astrojs/markdown-remark` and set
  `markdown: { processor: unified() }` to keep the old pipeline. Documented and
  supported, not a hack.

**Rust compiler is the default and only compiler** (PR #16462) — stricter about invalid
HTML. `@astrojs/mdx@8` likewise now uses a Rust MDX compiler; I saw its error prefix
`(mdxjs-rs:oxc)` in a failure trace. Relevant to MDX authors: malformed markup in an
MDX body that Astro 5 silently repaired will now error or render differently.

**Vite 8.**

### Astro 7.1.0 (2026-07-16)

**`deferRender` added to `glob()`** (PR #17302) — lets you opt `.md` collections into
the same deferred path MDX already uses, to bound build memory. Default `false`.
Irrelevant at portfolio scale; noted for completeness.

**Experimental `collectionStorage: 'chunked'`** — splits `.astro/data-store.json` across
many content-addressed files for very large collections. Irrelevant here.

### Astro 7.2.0 (2026-08-06)

**`digest` added to `CollectionEntry`** (PR #17084). Present in my measured entry keys.

### Astro 7.3.x

Patch-level content fixes: `getCollection()`/`getEntry()` no longer throw
`DataCloneError` when a schema transform returns a class instance such as
`Temporal.PlainDate` (PR #17631); performance improvement for entries without local
image references (PR #17547); hash-collision fix in generated content-collection image
import identifiers (PR #17602).

### What did NOT change

`src/content.config.ts` resolution, `defineCollection`, `glob()`/`file()`, the `Loader`
interface, `getCollection`/`getEntry`/`getEntries`/`reference`, `render()` and its three
return values, `CollectionEntry`'s core shape, and the server-only nature of
`astro:content`. **If your mental model is Astro 5's Content Layer API, it is still
correct.**

---

## 7. Deriving a navigable tree from flat ids

**Astro offers nothing built-in. This is entirely hand-rolled.** I looked: no tree
utility in `astro:content`'s exports, nothing in the content-collections guide, nothing
in the loader reference.

The only thing the docs offer is *filtering by id prefix*, which they present as the way
to work with nested directories:

> *"The filter argument also supports filtering by nested directories within a
> collection. Since the `id` includes the full nested path, you can filter by the start
> of each `id` to only return items from a specific nested directory"*

```astro
const englishDocsEntries = await getCollection('docs', ({ id }) => {
  return id.startsWith('en/');
});
```

— content-collections guide, "Querying collections".

That is the whole of the built-in support. Building a real `ls`/`cd` tree means writing
roughly thirty lines: split each `id` on `/`, walk/create directory nodes, attach the
entry at the leaf. Do it **once, in the `.astro` page at build time**, and pass the
finished tree to the island as props — not in the island at runtime.

Two sharp edges the hand-rolled code must handle, both established in section 1:

1. **`index.mdx` collapses to the directory id**, so a node can be both a directory and
   a file. Decide whether `cd deep` then `cat .` prints `deep/index.mdx`, or whether
   directory-index entries are forbidden.
2. **Intermediate directories have no entry of their own** unless you create an
   `index.mdx`. `deep/nested/deep-thing` implies directories `deep` and `deep/nested`
   that may have no title, no icon, no frontmatter. The tree builder must synthesise
   them, and ticket 05 must say where their display names come from.

I found no established community pattern worth copying — this is a fifteen-minute
function and every project writes its own. **Write it, unit-test it, and treat it as the
single definition of the filesystem** that both the window UI and the terminal read.

---

## 8. One MDX source, two shells: window and page

The question: a single collection entry's body must render both inside a draggable
window in the `client:only` React shell **and** at `/projects/orbital-mesh` as an
ordinary prerendered page.

**Answer up front.** Five options are real. Two are good. The recommended one is **(e2):
render every body to an HTML string at build time via a static JSON endpoint, and have
the island fetch and inject the one it needs.** The runner-up is **(a) named slots**,
which is more idiomatic and needs no experimental API, but ships every body in the
landing page's HTML and cannot grow lazily.

The summary table, then the evidence:

| | approach | ships to browser | duplicated on wire? | documented? | verdict |
| --- | --- | --- | --- | --- | --- |
| a | Astro `<slot>` into the island | all slotted bodies, in the landing HTML, inside `<template>` | yes, once per page that slots them | yes, directive-level | **viable**, fixed set |
| b | fragment route + `fetch` + `dangerouslySetInnerHTML` | one body per request | no | workaround | works, but N requests + style bugs |
| c | `@mdx-js/rollup` second pipeline | compiled React component per body | yes | workaround | works; **loses image optimisation and heading ids** |
| d | raw markdown + client-side renderer | body text + 14-50 KB gzip parser | no | workaround | **do not** |
| e1 | `.md` instead of `.mdx`, use `entry.rendered.html` | whatever you serialise | your choice | yes | **simplest, if you can drop MDX** |
| e2 | Container API to HTML strings in a static JSON endpoint | one JSON, fetched on demand | no | experimental API | **recommended** |

### (a) Handing the rendered MDX to the island — slots DO work with `client:only`

First, the part you predicted correctly: **`render()` returns an Astro component
factory, and React cannot render it.** There is no conversion. `Content` is created by
`createComponent(...)` at `runtime.js:434` and is meaningless to React. Passing it as a
prop is doubly impossible because island props must be JSON-serialisable.

But the slot workaround is real, and — contrary to the suspicion in the brief — **it
works with `client:only` in Astro 7.3.5. I verified it in a real headless Chrome, not
just in the build output.**

```astro
<SlotIsland client:only="react">
  <article slot="orbital-mesh"><A /></article>
  <article slot="deep"><B /></article>
</SlotIsland>
```

**How it works.** At build time Astro renders the MDX to HTML and puts each named slot
into a `<template data-astro-template="...">` inside `<astro-island>`, plus an
`await-children` attribute. Measured from `dist/index.html`:

```html
<astro-island ... client="only" opts="..." await-children>
  <template data-astro-template="orbital-mesh"><article><h1 id="orbital-mesh">Orbital Mesh</h1>...</article></template>
  <template data-astro-template="deep">...</template>
  <!--astro:end-->
</astro-island>
```

At runtime the island runtime harvests those templates into a slots object and removes
them; `@astrojs/react`'s client then turns each **named** slot into a prop
(`node_modules/@astrojs/react/dist/client.js`):

```js
for (const [key, value] of Object.entries(slotted)) {
  props[key] = createElement(StaticHtml, { value, name: key });
}
```

and `StaticHtml` is a `dangerouslySetInnerHTML` wrapper
(`@astrojs/react/dist/static-html.js`):

```js
const StaticHtml = ({ value, name, hydrate = true }) => {
  if (value == null || value.trim() === "") return null;
  const tagName = hydrate ? "astro-slot" : "astro-static-slot";
  return h(tagName, { name, suppressHydrationWarning: true, dangerouslySetInnerHTML: { __html: value } });
};
```

**Browser-verified.** I served the static build and dumped the post-hydration DOM with
`google-chrome --headless --dump-dom`. The MDX appears exactly where `{props['orbital-mesh']}`
was placed in the React tree, and React state can switch between slots:

```html
<astro-island ... client="only" ... await-children="">
  <section id="slot-island"><button>next</button>
    <div id="slot-target"><astro-slot name="orbital-mesh"><article>
      <h1 id="orbital-mesh">Orbital Mesh</h1>
      <p>Some <strong>bold</strong> text and a <a href="https://example.com">link</a>.</p>
      ...
    </article></astro-slot></div>
  </section>
</astro-island>
```

Full Astro fidelity: heading ids, optimised images, everything.

**What it actually costs, and why it is the runner-up and not the winner:**

- **Every slotted body ships in the landing page's HTML**, always, whether or not any
  window is opened. With N projects you pay all N on first paint. There is no
  lazy slot.
- **The content is inert to React.** `StaticHtml` is `memo(StaticHtml, () => true)` —
  it *never* re-renders. Fine for static prose; useless if window content must update.
- **It is invisible without JavaScript.** With `client:only` the slots live in
  `<template>` elements, which render nothing. Crawlers and no-JS users see an empty
  landing page. (This is fine here — the real pages at `/projects/...` carry the SEO —
  but it should be a conscious choice.)
- **The slot set is fixed at build time.** A terminal that can `cat` an arbitrary path
  needs every possible body present up front.
- The documented use of slots with `client:only` is narrower than this —
  *"For components that render only on the client, it is also possible to display
  fallback content while they are loading. Use `slot="fallback"`..."* (directives
  reference). Named content slots into `client:only` are **not** documented as such.
  They work — I verified it — but they are relying on behaviour the docs do not promise.

### (b) Prerendered HTML fragment routes, fetched and injected

Build a route that emits only the body:

```astro
---
// src/pages/frag/[...id].astro
export async function getStaticPaths() { /* one path per entry */ }
const { Content } = await render(Astro.props.entry);
---
<Content />
```

Verified: this produces genuinely tiny static files. Measured sizes:

```
201 B  dist/frag/orbital-mesh/index.html
228 B  dist/frag/upper-case_name/index.html
 33 B  dist/frag/deep/index.html
```

**Images survive perfectly.** The fragment for the entry containing
`![alt text](./img.png)` came out with Astro's optimised asset:

```html
<img src="/_astro/img.BUpoJRNg_ZDVg6J.webp" alt="alt text" loading="lazy" decoding="async" width="10" height="10">
```

So asset handling is **not** broken by this approach. That was worth checking and the
answer is reassuring.

**Scoped styles, however, are broken and weird.** A `<style>` block in the fragment
`.astro` has no `<head>` to be injected into, and Astro's head-injection does something
non-deterministic with it. For the entry with an image, the page's scoped style landed
*inside a paragraph, mid-sentence*:

```html
<p>Upper body with an image <style>article[data-astro-cid-2rg7qiff]{color:red}
</style><img src="/_astro/img...webp" ...> inline.</p>
```

and for entries without propagated assets the style was **dropped entirely**. Rule:
**fragment routes must carry no scoped styles.** Style the injected content from the
parent document instead. (Related: Astro 7.2.2, PR #17611, fixes a bug about
"component styles rendered from content entries" — this area has known rough edges.)

Two more gotchas:

- Astro prepends `<!DOCTYPE html>` to every fragment. Strip it before injecting, or
  accept a stray text node.
- The default `build.format` writes `dist/frag/orbital-mesh/index.html`, so the island
  must fetch `/frag/orbital-mesh/` **with the trailing slash** or eat a redirect on
  Cloudflare Pages.

**Cost:** one HTTP request per opened window. On a CDN that is cheap and cache-friendly,
and nothing ships until a window is actually opened. But it is N round trips for N
windows, and the style fragility is a standing trap.

**Verdict:** works, and is the right answer if bodies are large and rarely opened. For
a portfolio with a handful of projects, (e2) bundles the same content into one request
with none of the style weirdness.

### (c) A second MDX pipeline via `@mdx-js/rollup`

**It works, and it does not conflict with `@astrojs/mdx` — provided the two never see
the same module id.** I got this fully working and measured it.

Two ways to wire it, and the naive one fails:

1. **A distinct file extension.** `mdxRollup({ mdxExtensions: ['.reactmdx'], include: ['**/*.reactmdx'] })`
   with `enforce: 'pre'`. Note `include` alone is **not** enough — the plugin also gates
   on extension (`@mdx-js/rollup/lib/index.js:94-97`):
   ```js
   if (file.extname && filter(file.path) && formatAwareProcessors.extnames.includes(file.extname))
   ```
   Without `mdxExtensions` the transform silently never runs and rolldown then tries to
   parse Markdown as JavaScript (`[PARSE_ERROR] Invalid Character`). But a separate
   extension means a **second copy of the content** — it defeats "one source".

2. **A virtual module over the same `.mdx` file** — this is the one that preserves a
   single source of truth. A ~20-line Vite plugin resolves `react-mdx:<id>`, reads
   `src/content/projects/<id>.mdx`, strips frontmatter, and runs `@mdx-js/mdx`'s
   `compile()`. Verified working.

   **Critical gotcha:** the virtual id must **not end in `.mdx`**. `@astrojs/mdx`'s
   transform filter is a bare regex on the module id
   (`node_modules/@astrojs/mdx/dist/vite-plugin-mdx.js`):
   ```js
   transform: { filter: { id: /\.mdx$/ }, ... }
   ```
   which happily matches virtual ids. My first attempt used `react-mdx:orbital-mesh.mdx`
   and Astro tried to re-compile the already-compiled JavaScript as MDX:
   ```
   2:1: Unexpected statement in code: only import/exports are supported (mdxjs-rs:oxc)
   ```
   Dropping the extension from the virtual id fixed it.

**What ships:** a real React component, tiny. The whole island chunk for one body was
**685 bytes**. No markdown parser in the bundle. This is by far the smallest payload of
any option.

**But the fidelity loss is serious, and it is why this is not the recommendation.** The
emitted chunk for the body containing an image was:

```js
(0,t.jsx)(n.img,{src:`./img.png`,alt:`alt text`})
```

- **Images are not processed.** `src="./img.png"` is a dead relative URL. Astro's
  optimiser never ran; there is no `/_astro/img.*.webp`. You would have to write your
  own image resolution.
- **No heading ids.** The Astro copy emits `<h1 id="orbital-mesh">`; this copy emits a
  bare `<h1>`. Your in-window anchors and the `headings` array would disagree with the
  page version.
- **No GFM, no SmartyPants** unless you add plugins yourself — and they would be
  *remark* plugins, whereas Astro 7's page rendering now uses Sätteri. **You would be
  maintaining two Markdown pipelines with different plugin ecosystems and subtly
  different output for the same source file.** That is a bad place to be.

**Verdict:** technically the cheapest on the wire, genuinely a maintenance trap. Only
choose this if window bodies are deliberately plain prose with no images.

### (d) Raw markdown + a client-side renderer

**Do not do this.** Measured marginal bundle cost over an island that already has
React, esbuild `--bundle --minify`, gzip -9:

| entry | raw | **gzip** | marginal over baseline |
| --- | --- | --- | --- |
| baseline (`dangerouslySetInnerHTML` only) | 1.4 KB | **0.8 KB** | — |
| `marked` 18.0.14 | 45.7 KB | **13.9 KB** | +13.1 KB |
| `react-markdown` 10.1.0 | 124.4 KB | **38.7 KB** | +37.9 KB |
| `markdown-it` 15.0.2 | 97.9 KB | **40.3 KB** | +39.5 KB |
| `react-markdown` + `remark-gfm` 4.0.1 | 162.0 KB | **49.5 KB** | +48.7 KB |

For context the React runtime itself is 68 KB gzip in this build, so `react-markdown`
+ GFM would add ~70% on top of React just to re-parse content Astro already parsed.

And you still lose, versus the Astro-rendered version:

- **Image optimisation** — `![](./img.png)` stays a dead relative path.
- **MDX component embedding** — a Markdown renderer cannot execute JSX. Any `<Foo />`
  in the body is dropped or printed literally. Your content is MDX; this is fatal.
- **Heading ids / anchors**, unless you add more plugins (more bytes).
- **Syntax highlighting** — Astro's Shiki runs at build time; a client renderer needs a
  highlighter shipped to the browser, which is another large dependency.
- **Output parity with the `/projects/...` page.** Two renderers, two results.

**One narrow exception:** if `cat` is meant to print *raw markdown source as plain
monospace text* — which is arguably the more authentic terminal behaviour — then you
ship `entry.body` as a string and render it in a `<pre>`. That costs **zero** extra
bytes of library, needs no renderer at all, and is genuinely charming. Worth putting to
ticket 08 as a design question: **should `cat` print source or rendered prose?** If the
answer is "source", most of section 8 evaporates.

### (e) The options you did not list — and the recommendation

#### (e1) Author bodies as `.md`, not `.mdx`

The cheapest fix is upstream of all of this. Per section 5, a `.md` entry carries
`entry.rendered.html` as a **plain string** in the data store, with headings metadata
attached, at zero cost:

```ts
const notes = await getCollection('notes');
notes[0].rendered.html
// "<h1 id=\"note-one\">Note One</h1>\n<p>Plain <strong>markdown</strong> note.</p>\n"
```

Serialise that into props or a JSON endpoint and you are done — one source, two shells,
no experimental APIs, no second pipeline, full Astro fidelity including image
optimisation and Shiki highlighting.

**This is worth a hard look in ticket 05.** "Content is MDX" may be an assumption rather
than a requirement. If project write-ups do not actually embed components, `.md` makes
the whole problem disappear. If *some* do, consider splitting: `.md` for the collection
the terminal reads, `.mdx` reserved for pages that genuinely need components.

#### (e2) The Container API — render MDX to HTML strings at build time. RECOMMENDED.

If you must keep MDX, this is the idiomatic-in-spirit answer and it works today. Astro's
Container API can render the `Content` component to a **string** inside an ordinary
static endpoint:

```ts
// src/pages/bodies.json.ts
import { getCollection, render } from 'astro:content';
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import mdxRenderer from '@astrojs/mdx/server.js';

export const GET = async () => {
  const container = await AstroContainer.create();
  container.addServerRenderer({ name: '@astrojs/mdx', renderer: mdxRenderer });
  const out: Record<string, unknown> = {};
  for (const entry of await getCollection('projects')) {
    const { Content, headings } = await render(entry);
    out[entry.id] = { title: entry.data.title, headings, html: await container.renderToString(Content) };
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
};
```

**Verified end to end in a static build.** `dist/bodies.json` was generated as a flat
file. Actual measured output:

```json
{
  "orbital-mesh": {
    "title": "Orbital Mesh",
    "headings": [{"depth":1,"slug":"orbital-mesh","text":"Orbital Mesh"},
                 {"depth":2,"slug":"section-two","text":"Section Two"}],
    "html": "<h1 id=\"orbital-mesh\">Orbital Mesh</h1>\n<p>Some <strong>bold</strong> text and a <a href=\"https://example.com\">link</a>.</p>\n..."
  },
  "upper-case_name": {
    "html": "<p>Upper body with an image <img src=\"/_astro/img.BUpoJRNg_ZDVg6J.webp\" alt=\"alt text\" loading=\"lazy\" decoding=\"async\" width=\"10\" height=\"10\"> inline.</p>"
  }
}
```

Note the image: **`/_astro/img.BUpoJRNg_ZDVg6J.webp`**. Astro's optimiser ran. Heading
ids are present. Headings metadata comes along for free. This is byte-for-byte the same
HTML the `/projects/orbital-mesh` page serves.

- **What ships:** one static JSON, fetched once when the first window opens. Four toy
  entries were 957 B raw / **431 B gzip**. Realistically a few KB gzip for a portfolio.
- **Duplicated on the wire?** No — nothing is in the landing HTML, and the
  `/projects/...` pages are separate navigations. A visitor who both opens a window and
  visits the page downloads that body twice, but never twice in one page load. If you
  want, split it into one JSON per entry to fetch only what is opened; that is
  approach (b) without the style bugs.
- **Injection** is `dangerouslySetInnerHTML` in React, same as the slot path does
  internally. No markdown parser in the bundle.

**The one real cost: the Container API is still experimental in Astro 7.**

> *"This API is experimental and subject to breaking changes, even in minor or patch
> releases."* — [Container API reference](https://docs.astro.build/en/reference/container-reference/)

The docs also say it is *"currently scoped to allow testing of `.astro` component
output"*, so this is a use beyond its stated scope. It is `Since v4.9.0` and still
actively developed (`renderComponent()` was added in **7.3.5**), so it is not
abandonware — but pin your Astro version and re-test on every upgrade. Mitigation: the
blast radius is a single build-time endpoint file. If a future Astro breaks it you
rewrite ~15 lines, and you can fall back to (a) slots without touching the island's
rendering code, since both paths end in an HTML string.

### Should the window contain the full body at all?

You asked me to say so plainly if the honest answer is no. **My honest answer is: not
necessarily, and ticket 05 should decide this before picking a mechanism.**

All five options above are engineering answers to a question the design has not settled.
A desktop-metaphor window showing a full long-form project write-up is a scrollable
document inside a draggable box — it competes with the real page at `/projects/...`
rather than complementing it, and it forces every one of the trade-offs above.

Two cheaper designs that would make this section largely moot:

- **The window shows a summary, the page shows the body.** Title, a `description` from
  frontmatter, hero image, tech-stack chips, and an "open in new window"/"view page"
  link to the real route. All of that is `entry.data` — plain serialisable frontmatter,
  passed as props, no HTML strings, no fetching, no second pipeline. This is the
  cheapest design by a wide margin and it gives the real page a reason to exist.
- **`cat` prints raw source.** As noted in (d): authentic to the metaphor, zero library
  cost, and `entry.body` is right there.

If the design genuinely wants full prose in the window, take **(e2)**; if you can
relax MDX to `.md`, take **(e1)**, which is strictly simpler. Use **(a) slots** if you
want to avoid experimental APIs and can accept every body loading up front.

---

## Measurement method

Two throwaway sandboxes under the session scratchpad. Nothing was installed into this
repo, and no project file was modified.

1. **`cc/`** — a real Astro 7.3.5 project, `output: "static"`, no adapter, with
   `@astrojs/mdx` and `@astrojs/react`. Two collections (`projects` as `**/*.mdx`,
   `notes` as `**/*.md`) over content deliberately chosen to probe id generation:
   a top-level file, a two-level nested file with a space in its name, a directory
   `index.mdx`, and a file with uppercase and an underscore plus a real PNG image
   reference. Routes: a `[...id].astro` page route, a bare `[...id].astro` fragment
   route, a `client:only` island page taking both props and named slots, a
   `dump.json.ts` endpoint that reflects `Object.keys()` and every property of every
   entry, and a `bodies.json.ts` endpoint driving the Container API. Each question was
   answered by reading `dist/` after `astro build`, not by inference.
2. **`bundletest/`** — esbuild entries (`--bundle --minify --format=esm --jsx=automatic
   --define:process.env.NODE_ENV="production"`) isolating the four client-side Markdown
   renderers against a `dangerouslySetInnerHTML` baseline. gzip -9 computed on the
   emitted files. (brotli was not available on this machine, so unlike research doc 01
   these are gzip-only.)

**Browser verification:** `dist/` served over `python3 -m http.server`, post-hydration
DOM captured with `google-chrome --headless --dump-dom --virtual-time-budget=6000`.
This is how the `client:only` slot behaviour in section 8(a) was confirmed rather than
merely inferred from the built HTML.

**Negative results were produced by actually breaking the build**, not assumed: the
`astro:content`-in-client error, the `prerender = false` / no-adapter error, the
`@mdx-js/rollup` extension-filter failure, and the `@astrojs/mdx` virtual-id collision
were each reproduced and the verbatim error captured.

Source-level claims cite the **installed** `node_modules` of astro 7.3.5 /
@astrojs/mdx 8.0.2 / @astrojs/react 7.0.0, i.e. the code that actually runs, not GitHub
`main`.

## Sources

- Content collections guide: <https://docs.astro.build/en/guides/content-collections/>
- `astro:content` module reference: <https://docs.astro.build/en/reference/modules/astro-content/>
- Content loader reference (`glob`, `generateId`, `retainBody`, `deferRender`): <https://docs.astro.build/en/reference/content-loader-reference/>
- `astro/zod` reference: <https://docs.astro.build/en/reference/modules/astro-zod/>
- Markdown content guide (processors, Sätteri vs unified): <https://docs.astro.build/en/guides/markdown-content/>
- Add reading time recipe: <https://docs.astro.build/en/recipes/reading-time/>
- Container API reference (experimental): <https://docs.astro.build/en/reference/container-reference/>
- Directives reference (`client:only`, fallback slot): <https://docs.astro.build/en/reference/directives-reference/>
- `ServerOnlyModule` error: <https://docs.astro.build/en/reference/errors/server-only-module/>
- `NoAdapterInstalled` error: <https://docs.astro.build/en/reference/errors/no-adapter-installed/>
- Upgrade to v7: <https://docs.astro.build/en/guides/upgrade-to/v7/>
- Upgrade to v6: <https://docs.astro.build/en/guides/upgrade-to/v6/>
- Astro CHANGELOG (7.1.0 `deferRender` PR #17302, 7.2.0 `digest` PR #17084, 7.3.x content fixes): <https://github.com/withastro/astro/blob/main/packages/astro/CHANGELOG.md>
- Sätteri: <https://satteri.bruits.org/>
- Installed source: `astro/dist/content/loaders/glob.js`, `astro/dist/content/utils.js`, `astro/dist/content/runtime.js`, `astro/dist/content/vite-plugin-content-virtual-mod.js`, `astro/dist/virtual-modules/live-config.d.ts`, `@astrojs/mdx/dist/index.js`, `@astrojs/mdx/dist/vite-plugin-mdx.js`, `@astrojs/react/dist/client.js`, `@astrojs/react/dist/static-html.js`, `@mdx-js/rollup/lib/index.js`
- Version timeline: `npm view astro time`

## Open questions

- **Is the content actually required to be MDX?** The single highest-leverage
  unresolved question, and it belongs to ticket 05, not to me. If project bodies embed
  no components, `.md` gives you `entry.rendered.html` for free and most of section 8
  becomes unnecessary. Resolvable by looking at what the write-ups need to do.
- **Should the window contain the full body at all?** Also ticket 05. See the end of
  section 8. My recommendation is summary-in-window, body-on-page, but that is a design
  call.
- **Should `cat` print raw source or rendered prose?** Ticket 08. Raw source is free,
  more authentic, and sidesteps the whole rendering question.
- **Container API stability across Astro upgrades.** Documented as breakable in patch
  releases. I verified it on 7.3.5 only. If (e2) is adopted, add a build-time assertion
  that `bodies.json` is non-empty and well-formed, so an upgrade that breaks it fails
  the build rather than shipping empty windows.
- **Named slots into `client:only` are undocumented.** Verified working in 7.3.5 in a
  real browser, but the directives reference only documents `slot="fallback"` for
  `client:only`. Unlike the Container API there is no stability promise *or* warning —
  it is simply not written down. Slightly uncomfortable to depend on.
- **Sätteri plugin ecosystem maturity.** I confirmed Sätteri is the default and that
  the reading-time recipe has been ported, but I did not write or run a Sätteri mdast
  plugin. If ticket 05 wants reading time, custom directives, or anything beyond GFM +
  SmartyPants, someone should spend thirty minutes writing one before the content model
  commits to it. This is the largest genuinely unexplored risk in the Astro 7 move.
- **`prerenderConflictBehavior`.** I saw it referenced in `glob.js` around duplicate-id
  handling but did not chase its config surface or defaults. Only matters if the
  content tree ends up with colliding ids (`deep.mdx` vs `deep/index.mdx`).
