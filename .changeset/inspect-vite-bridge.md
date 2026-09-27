---
'@expressive/inspect': minor
---

Rename `@expressive/inspect/playwright` to `@expressive/inspect/bridge` - it drives anything with `evaluate(fn, arg)` (Playwright, puppeteer, a wrapped CDP session). Update the import path, and call `act` where you called `around` - the bridge now uses the in-process name. `/bridge` also exports `devtools(endpoint?, pick?)`, which connects to a Chrome DevTools Protocol endpoint (a Node process under `--inspect`, or a browser with a debug port) as an `evaluate` target; `pick` is a predicate or a string matched against title and URL, and zero or several matches throw with the target list.

Add `@expressive/inspect/vite`, a dev-server plugin that installs the inspector and relays `GET /__inspect` and `POST /__inspect/:id` (`[method, ...args]`) to open pages over Vite's HMR socket, so an agent can query the page a developer has open with `curl`. A connected page records `keys` from load unless the app sets a level, and `["act", [method, ...args], options?]` runs one call and answers `{ value, frames, settled, pending }`. Dev server only; it answers local callers and refuses browser and proxied (tunnel) requests - a dev server exposed through a proxy that strips forwarding headers is its owner's to secure.

`act` records values for its window whatever the journal level - previously only when it was off, so a `keys` recording returned frames without values.
