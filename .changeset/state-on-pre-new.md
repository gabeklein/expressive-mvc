---
'@expressive/mvc': minor
---

**Breaking:** `State.on` takes only a handler object, per-instance stages are renamed after their slot, and `catch` receives what was thrown instead of a `Caught`.

- `X.on(fn)` → `X.on({ pre: fn })` - a bare function now throws.
- `before` → `pre` - runs before own values are observed, args, and `new()`.
- `after` → `new` - runs with the instance's `new()`, after args apply.
- `catch(error)` → `catch(error, kind, key?)` - `error` is what was thrown (or an `Error` for a destroyed write or an inactive state), `kind` is `Effect`, `Getter`, `Init`, `Destroyed` or `Inactive`. Branch on `kind` where `instanceof Caught.*` was used.
- `Caught` and `Caught.log` are removed. Unhandled, an error escapes as thrown rather than wrapped.
