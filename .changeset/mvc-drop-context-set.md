---
"@expressive/mvc": minor
---

`context.set(inputs, forEach?)` is removed. `push(input?, cleanup?)` and the `Context` constructor register a class, an instance, or an object of them once - no reconciliation across calls. Every input is registered before any activates. `cleanup` runs once when the new context pops, before its inputs are removed.
