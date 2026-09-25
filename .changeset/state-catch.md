---
'@expressive/mvc': minor
'@expressive/react': minor
---

A write to a destroyed state is dropped and reported instead of thrown - async callbacks that land after teardown no longer surface as unhandled rejections, which crash a Node process. Subscribing to a destroyed state still throws.

Add `State.on({ catch(error) })` and an exported `Caught` error class (re-exported from `@expressive/react`). Everything mvc used to log arrives as a `Caught` subclass, each a static property: `Destroyed` and `Inactive` (`warning: true`), `Getter`, `Init` and `Effect` (with `cause`). Each carries `state`, and `key` where it applies. Handlers chain like nested `catch` blocks - most-derived class first, last registered first: return the error (or a replacement) to pass it on, return nothing to handle it, throw to escape uncaught at once.

**Behavior change:** unhandled, a warning still goes to `console.warn`, but an error thrown by an effect, a refreshing getter, or an async initializer now escapes uncaught instead of going to `console.error` - it fails a test run and crashes a Node process. Register `catch` to handle them.

A listener returning a non-function value no longer queues it as a callback.
