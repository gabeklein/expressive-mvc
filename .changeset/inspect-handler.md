---
'@expressive/inspect': minor
---

Add `@expressive/inspect/http`: importing it installs the inspector, and its `handle` serves it over HTTP from a backend's own server. It takes each host's native handler arguments - Bun's `(req, server)`, Deno's `(req, info)`, Node/Express/Connect's `(req, res)`, or `(req, { ip })` - and reads the caller's address from them. Same body and answers as the Vite relay; `GET` describes the process (`pid`, `cwd`, `started`, `runtime`, `title`). Refuses non-loopback, browser, and proxied callers. The Vite relay now answers 404 for an unknown method, where it answered 500.
