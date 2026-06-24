---
"@expressive/router": minor
---

`Route.goto` now accepts a params object to swap route params in place: `route.goto({ id: '456' })` rebuilds the route's own pattern from its current match merged with the given overrides (`/document/123` -> `/document/456`). Any param works, not just the last (`goto({ b: '8' })` on `/a/:b/:c`), and an unprovided param that the current path can't supply throws the usual unresolved-parameters error. This replaces the `goto("../" + id)` idiom for sibling-param navigation. String `goto` (relative/absolute paths) is unchanged.
