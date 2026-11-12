---
"@expressive/mvc": patch
---

A synchronous throw while a Model activates - from an init callback, a `setup` or `ready` handler, or `new()` - now destroys the instance and everything it built before the error escapes `.new()`. Children that already activated run their cleanups, and Models constructed for the instance but not yet activated are destroyed rather than reported `unused`. Effects and pending reads waiting on the instance reject with the original error. Previously the half-built instance could no longer be destroyed, so its children were orphaned.
