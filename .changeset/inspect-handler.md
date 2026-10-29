---
'@expressive/inspect': minor
---

Add `handler(req, { ip })`, a web-standard `Request` → `Response` handler that serves an installed inspector over HTTP from a backend's own server (Bun, Deno, Workers, Hono, Next route handlers). Same body and answers as the Vite relay; `GET` describes the process. Refuses non-loopback, browser, and proxied callers, and answers 404 until `install` runs. The Vite relay now answers 404 for an unknown method, where it answered 500.
