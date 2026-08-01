---
"@expressive/react": minor
---

**Breaking:** the standalone `use(instance)` hook is removed.

Every job it did now has a first-class home: a module singleton declares `static global = true` and is read with `State.get()`; a shared instance is provided with `<Provider for={instance}>` and read with `get()`; a child reached through a subscribed parent is tracked by the parent's proxy with no extra hook; a `Component` instance in hand renders directly as `{instance}`. Subscribing to a raw by-reference instance outside any context is deliberately no longer supported - it was the one subscription path that bypassed Expressive-owned seams, and it collided with React 19's own `use()`.
