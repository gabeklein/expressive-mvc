---
'@expressive/dom': minor
---

`State.get()` outside a render no longer throws - it returns the unsubscribed instance from the ambient context. A root render's context is parented on `Context.get()`, so a host's per-request context reaches the tree. `State.use()` outside a render still throws.
