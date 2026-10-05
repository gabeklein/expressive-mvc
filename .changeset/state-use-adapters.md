---
'@expressive/react': minor
'@expressive/dom': minor
---

`State.use()` outside a render creates through core, in the ambient context, instead of failing. While rendering, `State.use()` throws if `get()` would already resolve that type - a provider, a global, a subclass instance, or in dom an upstream or earlier `use()` in the same render. Nest `<Component for>` to scope another instance.
