---
'@expressive/mvc': minor
---

A `get(Type, key, ...)` instruction resolves as its field is defined, so `new()` can read it; it ran after `new()` before. A `Type.get` that throws a Promise no longer throws it from construction - the field suspends readers and resolves once the Promise settles.
