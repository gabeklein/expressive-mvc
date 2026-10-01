---
'@expressive/inspect': patch
---

Recorded calls come from wrapping each class's methods as it bootstraps instead of per-instance wrappers - a method replaced through `set()` stays recorded, and methods are no longer reassigned on instances.
