---
"@expressive/mvc": patch
---

A synchronous throw during activation - from an init callback, a `setup` handler or `new()` - now destroys the instance and everything it built so far, owned and field children included, before the error escapes `.new()`. Previously the half-built instance could no longer be destroyed, so children that had already run `new()` were orphaned.
