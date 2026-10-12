---
'@expressive/react': patch
---

Destroy instances created by a render React discards before committing - a suspended first mount, a subtree removed while suspended, a dropped transition. `State.use()`, `<Component />` and `<Provider for={Type}>` previously left these activated and held in context indefinitely, with any `new()` effects still running. They are now destroyed once React releases the attempt (via `FinalizationRegistry`, so at garbage collection; runtimes without it keep the previous behavior). Instances React retains uncommitted, such as under a hidden `<Activity>`, are kept.
