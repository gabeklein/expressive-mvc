---
'@expressive/inspect': minor
---

Add `handle(req, { ip })`, a web-standard `Request` → `Response` handler that serves an installed inspector over HTTP from a backend's own server (Bun, Deno, Node, Hono). Same body and answers as the Vite relay; `GET` describes the process (`pid`, `cwd`, `started`, `runtime`). Refuses non-loopback, browser, and proxied callers, and answers 404 until `install` runs. The Vite relay now answers 404 for an unknown method, where it answered 500.
