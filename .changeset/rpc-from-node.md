---
"@expressive/rpc": minor
---

`fromNode(handler)` from `@expressive/rpc/node` makes an Express app, Connect middleware or any `(req, res, next)` a route's method: `export const GET = fromNode(app)`. It sees the path below the route, runs in the request's scope behind the folder's gates, streams what it writes, and answers `next()` with 404. A method export may now be made by a call - `fromNode(app)`, `app.fetch` - and is checked when it runs; one that takes `(req, res, next)` and returns nothing fails with a hint to wrap it.
