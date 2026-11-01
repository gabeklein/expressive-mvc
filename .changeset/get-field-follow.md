---
'@expressive/mvc': minor
---

`get(Type)` fields follow their context provider, as `Model.get()` and tracked lookups do. A field no longer holds a provider that left context: an optional field reads `undefined` and a required one suspends until another arrives. Owner and siblings still win. A callback's returned cleanup now runs when its upstream is replaced or leaves, not only on destroy.
