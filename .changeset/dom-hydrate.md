---
"@expressive/dom": minor
---

`hydrate(node, container)` mounts over `renderToString` markup, adopting its nodes instead of replacing them. Mismatches are mended in place, and a subtree that suspends keeps its server markup until it renders.
