---
'@expressive/react': minor
---

A class overriding static `Model.get` keeps tracking. Bare `Context.get()` returns the render's context as before. Outside a render, `Model.get()` and overrides of static `get` no longer throw an invalid hook call - they resolve from root, untracked, which may not be the instance the component rendered. Read it in render and use that in handlers.
