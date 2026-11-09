---
"@expressive/dom": minor
---

A `$name` field on a `Style` pack that is not a condition declares a CSS variable - its value is the default, emitted once at `:where(:root)` under a name from the key (`readonly $inkLight = '#222'` → `--ink-light`), or a `--name` to use as is. A `$ink` key sets it: in `use()` rules a default, under named conditions too; in a component map an override for that subtree. `style.$` holds plain `var()` references (`$.ink`). `style.define({ ink })` sets variables at `:root` over the defaults, replacing its last call - a library's `define` lets an app retheme its components. A `$name` field must be a string.
