---
'@expressive/mvc': minor
---

`new()` may be async: its declared return admits `Promise<void>`, and an async `new()` - or any setup step returning a promise - now holds the `ready` stage (`on({ ready })`) and the first run of every effect registered before it resolves. `await state.get(() => {})` therefore waits for an instance to be ready. A rejection reports to `catch` as `setup`, then destroys the instance, so a pending effect's awaited release rejects rather than hangs. Synchronous activation is unchanged.
