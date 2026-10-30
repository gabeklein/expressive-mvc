---
'@expressive/mvc': minor
---

`get(Type, key, ...)` instruction resolves `Type.get` as an effect: it re-runs when a provider the override looked up, or a value it read, changes. A Promise thrown by the override suspends the field and retries once settled, instead of throwing from `new()`. Errors on later runs go to `catch` as `'effect'`.
