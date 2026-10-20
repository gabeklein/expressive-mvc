---
"@expressive/mvc": minor
---

`context.set(inputs, forEach?)` is removed. `push(input?, cleanup?)` takes a single class or instance and an optional `cleanup`, run once when the new context pops, before its input is removed. The map form (`push({ A, B })`, `new Context({ A, B })`) is removed - `add` instances or nest `push` calls instead.
