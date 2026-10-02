---
'@expressive/inspect': patch
---

Recorded calls come from wrapping each class's methods as it bootstraps instead of per-instance wrappers. A method replaced through `set()` stays recorded - it is rebound to a traced copy. Calls are not recorded for a class first constructed before inspect attached.
