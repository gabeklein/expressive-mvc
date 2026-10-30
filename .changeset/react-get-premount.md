---
'@expressive/react': patch
---

`Model.get()` refreshes on mount when its provider changed, or its lookup started failing, between render and commit; the change was dropped before.
