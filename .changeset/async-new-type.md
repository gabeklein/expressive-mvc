---
'@expressive/mvc': minor
---

`new()` may be async: its declared return admits `Promise<void>`, and a promise returned by `new()` - or by any activation step, a setup handler or a constructor callback - holds the `ready` stage (`on({ ready })`) until it resolves. A rejection reports to `catch` as `setup`, then destroys the instance. Synchronous activation is unchanged.
