---
'@expressive/mvc': minor
---

`<Component for={context}>` renders its subtree within a `Context` the caller owns: Models in it resolve below, and `context.pop()` destroys every instance the host constructed there. A server render ends a request this way - teardowns run, and a pending readiness await on a host-owned instance rejects instead of waiting for garbage collection.
