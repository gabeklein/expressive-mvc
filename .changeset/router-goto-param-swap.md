---
"@expressive/router": minor
---

`Route.goto` now accepts a params object to swap route params in place: `route.goto({ id: '456' })` rebuilds the route's path from its current match merged with the given overrides (`/document/123` -> `/document/456`). Any param the route declares works, not just the last (`goto({ b: '8' })` on `/a/:b/:c`). A route can only set the params it declares in its own `to`: inherited (ancestor) segments are filled read-only, and a key the route doesn't own throws (so in `<Route to="org/:orgId"><Route to="user/:userId"/></Route>` the inner leaf can swap `userId` but not `orgId`). A declared param the current path can't supply throws the usual unresolved-parameters error. This replaces the `goto("../" + id)` idiom for sibling-param navigation. String `goto` (relative/absolute paths) is unchanged.
