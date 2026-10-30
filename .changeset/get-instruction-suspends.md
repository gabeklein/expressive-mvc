---
'@expressive/mvc': minor
---

A `get(Type, key, ...)` instruction whose `Type.get` throws a Promise no longer throws it from `new()` - the field suspends readers and resolves once the Promise settles.
