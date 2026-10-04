---
'@expressive/mvc': minor
---

**Breaking:** `State.on` stages are renamed for when they run, and `catch` receives what was thrown instead of a `Caught`.

- `before` → `setup` - runs once the instance is constructed, before own values are observed, args, and `new()`.
- `after` → `ready` - runs after args apply and the instance's `new()` has run.
- `X.on(fn)` still registers a `setup` handler.
- `catch(error)` → `catch(error, kind, key?)` - `error` is what was thrown (or an `Error` for a destroyed write or an inactive state), `kind` is `effect`, `getter`, `setup`, `dead` or `unused`. Branch on `kind` where `instanceof Caught.*` was used.
- `Caught` and `Caught.log` are removed. Unhandled, an error escapes as thrown rather than wrapped.
