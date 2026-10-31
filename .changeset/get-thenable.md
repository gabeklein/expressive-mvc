---
'@expressive/mvc': minor
---

`state.get()` is awaitable: it resolves with the values once the instance is ready - after activation and any async setup - and rejects if the instance is destroyed first. While setup is pending the synchronous snapshot is empty. Typed `Model.Values<this> & PromiseLike<Model.Values<this>>`; the resolved object is a frozen plain tree.
