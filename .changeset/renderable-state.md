---
"@expressive/dom": minor
"@expressive/mvc": minor
---

Any `State` class renders as an element in `@expressive/dom`. With `render(props)` it produces content like a Component - attributes assign fields, `is`, `mount()` and destruction on unmount apply - and without one it passes children through. Either way the instance is provided to its subtree, so `<Session>…</Session>` replaces `<Provider for={Session}>`. A State element owns a suspense boundary only when it declares `fallback` or `catch`. `@expressive/mvc` types class element attributes from the instance: `props` when declared, else `Component.Attributes` derived from fields and `render`.
