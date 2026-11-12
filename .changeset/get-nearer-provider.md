---
'@expressive/mvc': patch
---

`get(Type)` prefers a provider nearer than the matching owner. A `<Component for={x}>` rendered inside a `Type` now resolves `get(Type)` below it to `x` rather than to the outer instance, matching `Type.get()`.
