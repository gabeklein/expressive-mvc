---
'@expressive/mvc': minor
'@expressive/react': minor
---

Add `State.on({ catch(error) })` and an exported `Caught` error class (re-exported from `@expressive/react`). Everything mvc used to log arrives as a `Caught` subclass, each a static property: `Inactive` (`warning: true`), `Destroyed`, `Getter`, `Init` and `Effect` (the last three with `cause`). Each carries `state`, and `key` where it applies. Handlers chain like nested `catch` blocks - most-derived class first, last registered first: return the error (or a replacement) to pass it on, return nothing to handle it, throw to escape uncaught at once.

A write to a destroyed state still throws to the writer - now a `Caught.Destroyed` - since that is what stops a continuation writing after teardown. A `catch` handler returning nothing drops it instead.

**Behavior change:** unhandled, a warning still goes to `console.warn`, but an error thrown by an effect, a refreshing getter, or an async initializer now escapes uncaught instead of going to `console.error` - it fails a test run and crashes a Node process. Register `catch` to handle them. A getter suspending on a pending value while refreshing is not reported.

A listener returning a non-function value no longer queues it as a callback.
