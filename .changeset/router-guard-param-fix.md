---
"@expressive/router": patch
---

A functional `redirect` guard now runs on a route whose own pattern contains a `:param` (e.g. `to="document/:id"`). The in-space check compared the literal, unsubstituted pattern against the URL, so any such route silently skipped its guard; it now gates on `matched`, which resolves captures.
