---
'@expressive/react': minor
---

A class overriding static `Model.get` keeps tracking. Bare `Context.get()` returns the render's context as before. Outside a render, `Model.get()` and overrides of static `get` resolve from root instead of throwing an invalid hook call.
