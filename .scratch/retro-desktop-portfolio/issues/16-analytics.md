# Analytics

Type: grilling
Status: open
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
