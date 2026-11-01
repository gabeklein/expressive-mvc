---
'@expressive/mvc': minor
---

An effect registered before an instance is ready - during construction, in `new()`, or while an async setup step is pending - holds its first run until the instance settles. Destroying the instance first rejects an awaited release instead of hanging it; one deferred effect throwing does not stop the rest.
