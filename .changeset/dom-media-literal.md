---
"@expressive/dom": patch
---

`media()` returns a literal type built from the query, so its result works as a computed key in a typed `style()` map. Features are joined in the order of the query interface rather than insertion order.
