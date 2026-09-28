# Resume delivery

Type: grilling
Status: resolved
Blocked by: —

## Question

`resume` is one of the IA's root nodes. Decide what it delivers: a rendered page, a PDF
download, or both. If both, which one is the source of truth, and how the other gets built
from it (for example a print stylesheet on the page, or a build-time PDF render). Also
decide what the resume node *is* in the content model (ticket 05): an entry in `pages`, a
structured data file, or something else. And decide what the shell does on `open resume` /
double-click compared with the page's maximise box. Keep the recruiter test in mind: this
is the one node a recruiter may want to forward as a file.

## Answer

The captain delegated this ticket ("plan the rest using sensible defaults"). Every call
below is the agent's default, and this is the first place to look if one grates.

### Both, and the page is the source of truth

The resume ships as **a page and a PDF**. The page is the source; the PDF is built from it.
A recruiter who forwards a file gets a file, and a recruiter who clicks gets a page with the
same words. There's one body of text, so the two can't drift.

- **Content model:** the resume stays what ticket 05 already made it, the `pages/resume`
  entry with a plain Markdown body. A structured data file (JSON Resume and the like) was
  rejected. It would add a second rendering mechanism for one entry, and headings,
  bullet lists and dates in Markdown are all a resume needs. `filename: resume.txt`, so
  `cat resume.txt` prints the raw Markdown like every other entry.
- **Filesystem:** the root holds **two** nodes. `resume.txt` is the `file` node: a content
  window in the shell, a page at `/resume/`. `resume.pdf` is ticket 05's existing `link`
  node, the download. That amends ticket 05's root listing by one line.
- **The PDF is rendered from `/resume/` with a print stylesheet**, by headless Chromium
  (Playwright) in a post-build step, and written to `dist/resume.pdf`. The print stylesheet
  is the same one a visitor gets from the browser's own Print, so "Save as PDF" from the
  page produces the same document.

### The print stylesheet

No chrome, no CRT, no taskbar, no breadcrumbs, no spec block. Black on white, IBM Plex Mono
(the renamed subset, embedded by Chromium), US Letter, 0.6in margins. Link URLs are printed
after the link text, because a printout can't be clicked. The build **warns** past two
pages, but doesn't fail.

### Shell and page behaviour

- **`open resume.txt`, a double-click, or the launcher** opens a content window like any
  entry. Its maximise box promotes to `/resume/`, the same as everywhere else. The resume
  gets no special-casing in the window manager.
- **`open resume.pdf` or double-clicking it** downloads the file, as a `link` node does.
  `cat resume.pdf` prints `cat: resume.pdf: binary file` and a dry second line.
- **The page and the window** both carry a `DOWNLOAD PDF` link at the top of the body
  area, with `download="joe-valdez-resume.pdf"`. The URL stays `/resume.pdf`, but the saved
  file has a name a recruiter can forward without renaming it.
- **Linear layout:** the `resume` Section (the placeholder row from ticket 11) shows the
  summary, a maximise box to `/resume/`, and the same download link.

### Knock-on: the build runs in GitHub Actions

Chromium in a post-build step, and Lighthouse CI in **Performance budget and enforcement**,
both need a CI runner that can install a browser. So **build and deploy run in GitHub
Actions**, with `wrangler pages deploy` of `dist/`, and not in Cloudflare Pages' own git
builds. This amends one detail of ticket 17: OG images are cached across deploys by
`actions/cache` on `node_modules/.astro` (keyed on the lockfile and the font hash), not by
Cloudflare's build cache. The 7-day purge hazard no longer applies.

### Vocabulary

"Resume" meant the returning visitor's one-line restart screen (tickets 10 and 11). The IA
node `resume` needs the word more: it's in a URL, a filename and a launcher. The glossary
now gives **Resume** to the document and renames the restart screen **Restore**. The
in-world copy `RESUME · N WINDOWS RESTORED` from ticket 10 is display text and stays as it
is.
