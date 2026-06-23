---
"@expressive/router": minor
---

`Route`'s `redirect` now accepts a function, optionally async, in addition to a static string - an entry guard for auth gates and the like. It is evaluated on entry to the route's scope (the current path falling within its subtree): a truthy string redirects there, a falsy result (`''`/`undefined`) allows normal render, and a returned `Promise` shows the route's `fallback` until it settles. The verdict is cached for navigations within the space and re-evaluated on re-entry. A static-string `redirect` behaves exactly as before; a function guard now participates in sibling matching until it actually redirects, so it can wrap a section (a `Route` with children) and gate the whole subtree.
