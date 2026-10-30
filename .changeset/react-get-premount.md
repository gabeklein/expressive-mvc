---
'@expressive/react': patch
---

`Model.get()` refreshes on mount when its provider changed between render and commit; the change was dropped before.
