---
'@expressive/react': patch
---

`Model.get` overrides whose lookups depend on their argument now follow providers for types first looked up on a re-render.
