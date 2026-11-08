---
"@expressive/rpc": minor
---

First release. Typed server calls for any Vite client build: `rpc()` from `@expressive/rpc/vite` turns a folder of `async` functions (`api/` by default) into client stubs and a server bundle that runs as a Cloudflare Worker or under Node through `toNode`. Ships the `HttpError` family rebuilt on the client, folder gates through an index's default Model and its `static key()`, `Current` for the request in a call, and `configure({ base, headers, transport, reply })` for the client. `rpc({ entry })` takes the app's own server module - routes, `scheduled` and Durable Objects beside the calls, which it gets from `@expressive/rpc/calls` - runs it on the dev server and bundles it as the server. Arguments and results carry `Date`, `BigInt`, `NaN`/`Infinity`, `Map`, `Set`, `Uint8Array` and `undefined` in arrays, tagged inside plain JSON.
