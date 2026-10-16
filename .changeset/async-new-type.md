---
'@expressive/mvc': minor
---

`new()` may be async: its declared return admits `Promise<void>`, and an async `new()` - or any setup step returning a promise - now holds the `ready` stage (`on({ ready })`) until it resolves. A rejection still reports to `catch` as `setup` and skips `ready`, as does a destroy before it settles. Synchronous activation is unchanged.
