---
"@expressive/mvc": patch
---

Fix stack overflow in `get()` snapshots when the model graph has a cycle not passing through root state.
