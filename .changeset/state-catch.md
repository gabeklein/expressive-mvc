---
'@expressive/mvc': minor
'@expressive/react': minor
---

A write to a destroyed state is dropped and reported instead of thrown - async callbacks that land after teardown no longer surface as unhandled rejections, which crash a Node process. Subscribing to a destroyed state still throws.

Add `State.on({ catch(error) })` and an exported `Error` (re-exported from `@expressive/react`). Everything mvc used to log arrives as an `Error` subclass on `Error`: `Destroyed` and `Inactive` (`warning: true`), `Getter`, `Init` and `Effect` (with `cause`). Each carries `state`, and `key` where it applies. A handler returning handles it; rethrowing lets it escape uncaught - to the writer for a destroyed write. Without a handler, output is unchanged except that each report logs as one `Error` object: warnings through `console.warn`, the rest through `console.error`.
