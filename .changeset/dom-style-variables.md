---
"@expressive/dom": minor
---

A `Style` pack names CSS variables with `$name` fields starting with `--` (`readonly $ink = '--app-ink'`) and constants with any other string. A `$ink` key declares the variable - in `use()` rules a default at `:where(:root)`, under named conditions too; in a component map an override for that subtree. `style.$` holds string tokens (`$.ink`) usable in templates, arrays and macros, rewritten to `var(--app-ink)` or the constant's text where a declaration applies. `style.define({ ink })` sets variables at `:root` over the defaults, replacing its last call - a library's `define` lets an app retheme its components. A `$name` field no longer has to be a condition, but must be a string.
