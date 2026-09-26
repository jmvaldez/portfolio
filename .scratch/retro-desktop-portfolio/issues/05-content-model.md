# Content model and the fake filesystem

Type: grilling
Status: claimed
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
