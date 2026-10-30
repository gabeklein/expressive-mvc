---
'@expressive/dom': minor
---

Outside render, `Model.get()` no longer throws - it reads the root context, untracked, which may not be the instance the component rendered. Read it in render and use that in handlers. A class overriding static `get` keeps tracking.
