---
'@expressive/inspect': minor
---

Rename `@expressive/inspect/playwright` to `@expressive/inspect/bridge` - it drives anything with `evaluate(fn, arg)` (Playwright, puppeteer, a wrapped CDP session). Update the import path; the API is unchanged.

Add `@expressive/inspect/vite`, a dev-server plugin that installs the inspector and relays `GET /__inspect` and `POST /__inspect/:id` (`[method, ...args]`) to open pages over Vite's HMR socket, so an agent can query the page a developer has open with `curl`. Dev server only; it answers local callers and refuses browser and proxied (tunnel) requests - a dev server exposed through a proxy that strips forwarding headers is its owner's to secure.
