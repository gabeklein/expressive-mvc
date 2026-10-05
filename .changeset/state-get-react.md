---
'@expressive/react': minor
---

`State.get()` outside a render - an event handler, a service - returns the unsubscribed instance from the ambient context instead of crashing on a hook call. `Context.get()` is no longer overridden: inside a render it returns root, not the nearest provider's context. With no provider above, components and providers fall back to `Context.get()`.
