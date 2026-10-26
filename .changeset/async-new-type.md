---
'@expressive/mvc': minor
---

`new()` may be async: its declared return admits `Promise<void>`, and an async `new()` - or any setup step returning a promise - now holds the `ready` stage (`on({ ready })`) until it resolves. A rejection still reports to `catch` as `setup` and skips `ready`, as does a destroy before it settles. Synchronous activation is unchanged. `state.get(true)` reads the same moment per instance, and `state.get(true, callback)` subscribes to it - called once ready, at once if already; called with the error instead if setup rejects or the instance is destroyed first.
