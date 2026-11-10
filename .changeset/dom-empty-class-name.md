---
"@expressive/dom": patch
---

Fix a crash when a styled component's name is only `_`, `$` or other symbols, as minifiers often emit: its generated class name was empty and the rule failed to insert. Such classes now fall back to `c`.
