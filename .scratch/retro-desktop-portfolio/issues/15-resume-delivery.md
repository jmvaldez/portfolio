# Resume delivery

Type: grilling
Status: open
Blocked by: —

## Question

`resume` is one of the IA's root nodes. Decide what it delivers: a rendered page, a PDF
download, or both. If both, which one is the source of truth, and how the other gets built
from it (for example a print stylesheet on the page, or a build-time PDF render). Also
decide what the resume node *is* in the content model (ticket 05): an entry in `pages`, a
structured data file, or something else. And decide what the shell does on `open resume` /
double-click compared with the page's maximise box. Keep the recruiter test in mind: this
is the one node a recruiter may want to forward as a file.
