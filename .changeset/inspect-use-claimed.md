---
'@expressive/inspect': patch
---

An instance `use()`d into the root context counts as claimed, like a global, instead of being reported as an orphan.
