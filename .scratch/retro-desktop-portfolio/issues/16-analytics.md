# Analytics

Type: grilling
Status: resolved
Blocked by: —

## Question

Whether to run analytics at all, and if so, which. The constraint is that content pages
are measured at 0 KB JS, and the only exception is the inline CRT-preference script
(ticket 09). A client beacon on every page breaks that. The options include no analytics,
Cloudflare Web Analytics (a JS beacon, cookieless), server-side or edge log analytics that
ship no client code (Cloudflare's zone-level analytics on Pages), and a self-hosted
cookieless tool. Decide which, what it's for (is there a question the analytics would
actually answer?), and whether its presence needs any disclosure. Registering the domain is
out of scope. This ticket is only about measurement.

## Answer

The captain delegated this ticket ("plan the rest using sensible defaults"). Every call
below is the agent's default.

### No client-side analytics in v1

**No beacon, no script, no cookie, on any page.** Content pages stay at the measured 0 KB of
external JS, and ticket 19's budget has no analytics line.

The test was "is there a question the analytics would actually answer?". The only real one
for a personal portfolio is *is anyone arriving, and from where* — did the link on the
resume or LinkedIn get clicked? Edge traffic numbers answer the first half. The second half
isn't worth a beacon on every page. It's also answerable without one: give the links Joe
controls distinct entry points if it ever matters. Nothing in the site would change its
design on the answer, which is the strongest sign that a client analytics tool would be
decoration.

- **Use whatever zero-code traffic numbers Cloudflare shows at the edge** for the Pages
  project and, once a domain is attached, the zone. Which ones are available depends on how
  the domain is attached, and that's the out-of-scope domain chore. None of it touches the
  page.
- **Rejected:** Cloudflare Web Analytics (a JS beacon on every page, which breaks the 0 KB
  line for no decision), and self-hosted cookieless tools like Plausible or Umami (a
  backend, against the map's "no backend in v1").
- **Disclosure:** none needed. Nothing runs in the visitor's browser and nothing is stored,
  so there's no privacy note and no banner.
- **Revisit trigger:** a concrete question the edge numbers can't answer. Adding a beacon
  then is a single-script change plus a new line in the performance budget.
