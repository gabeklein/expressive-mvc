---
'@expressive/react': minor
'@expressive/dom': minor
---

`Model.get` no longer accepts a function: the computed (`Model.get(fn)`), effect (`fn` returning `null`) and async forms are removed, with `Model.ForceRefresh`, `Model.GetFactory` and `Model.GetEffect` (react) and `Model.ForceRefresh` and `Model.GetFactory` (dom). Destructure and derive in render, declare a getter on the Model, or move side effects to `mount()`; `Model.get()`, `get(false)` and `get(true)` are unchanged.
