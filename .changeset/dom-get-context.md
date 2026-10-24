---
'@expressive/dom': minor
---

`Model.get` no longer accepts a function - the computed form and `Model.ForceRefresh` are removed; derive in render or declare a getter on the Model. Outside render, `Model.get()` now reads the root context instead of throwing. A class overriding static `get` keeps tracking.
