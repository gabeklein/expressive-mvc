---
"@expressive/router": patch
---

Construct `BrowserRouter` safely during server render.

`BrowserRouter` read `window.location.pathname` in a class-field initializer and bound `window`/`history` in `new()`, both of which run at construction - so activating one during `renderToString` threw `ReferenceError: window is not defined`.

The field now falls back to `'/'` when there is no `window`, and `new()` skips its browser binding on the server. A `BrowserRouter` activated during server render is inert at `'/'`; provide a `Router` per-request (e.g. via `<Provider>`) to render a request's actual path.
