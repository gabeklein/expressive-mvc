---
"@expressive/router": minor
---

A functional `redirect` guard returning `null` now **force-404s**: the route cedes its match for the current path and the scope falls through to its nearest `default`. This lets a page (or its data loader) decline a path it structurally matched - e.g. a fetch returning 401/404 - without revealing whether the resource is forbidden or absent. The decision is path-keyed (it marks only the concrete URL declined, cleared on navigation) and rides reactive `Router` state, so the section's `default` re-arbitrates without an error boundary. `null` is distinct from a falsy verdict (`''`/`undefined`), which still allows normal render.

Also: a functional guard now runs on routes whose own pattern contains a `:param` (e.g. `to="document/:id"`), which were previously skipped.
