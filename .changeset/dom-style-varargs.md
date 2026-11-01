---
"@expressive/dom": minor
---

`style()` takes several maps, layered in order as repeated calls would, skipping falsy entries: `style(Meta, shared, wide && compact, { whiteSpace: 'normal' })`.
