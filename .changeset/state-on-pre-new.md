---
'@expressive/mvc': minor
---

**Breaking:** `State.on` takes only a handler object, and per-instance stages are renamed after their slot.

- `X.on(fn)` → `X.on({ pre: fn })` - a bare function now throws.
- `before` → `pre` - runs before own values are observed, args, and `new()`.
- `after` → `new` - runs with the instance's `new()`, after args apply.
