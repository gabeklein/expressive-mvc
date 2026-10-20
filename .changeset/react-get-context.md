---
'@expressive/react': minor
---

`Model.get` no longer accepts a function: the computed (`Model.get(fn)`), effect (`fn` returning `null`) and async forms are removed, with `Model.ForceRefresh`, `Model.GetFactory` and `Model.GetEffect`. Destructure and derive in render, declare a getter on the Model, or move side effects to `mount()`. `Model.get()`, `get(false)` and `get(true)` are unchanged; a class overriding static `get` keeps tracking. `get(false)` now returns `undefined` once its instance leaves context. Bare `Context.get()` returns `Context.current` while one is set, otherwise the render's context as before.
