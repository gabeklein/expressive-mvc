---
'@expressive/inspect': patch
---

Recorded calls come from `State.on({ call })` instead of per-instance wrappers - a method replaced through `set()` stays recorded, and methods are no longer reassigned on instances.
