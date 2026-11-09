---
"@expressive/rpc": minor
---

The server entry's `fetch` runs in the request's scope: `Current` and `Cookies` work in its routes as in a call, and the headers and cookies they set join the route's response. `scoped(app)` from `@expressive/rpc/http` does the same for a host wrapping an entry itself.
