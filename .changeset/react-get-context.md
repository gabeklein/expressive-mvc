---
'@expressive/react': minor
---

`Model.get` no longer accepts a function: the computed (`Model.get(fn)`), effect (`fn` returning `null`) and async forms are removed, with `Model.ForceRefresh`, `Model.GetFactory` and `Model.GetEffect`. Destructure and derive in render, declare a getter on the Model, or move side effects to `mount()`. `Model.get()`, `get(false)` and `get(true)` are unchanged; a class overriding static `get` keeps tracking. Bare `Context.get()` returns the render's context as before. Outside a render, `Model.get()` and overrides of static `get` resolve from root instead of throwing an invalid hook call.
