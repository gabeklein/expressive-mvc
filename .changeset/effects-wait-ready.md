---
'@expressive/mvc': minor
---

An effect registered before an instance is ready - during construction, in `new()`, or while an async setup step is pending - holds its first run until the instance settles. Readiness is per tree: a parent's `ready` waits for the children it owned at activation to settle, and a hold on a parent when its children activate (an async `setup` handler) holds their `ready` and effects too; children settle first. Destroying the instance first rejects an awaited release instead of hanging it; one deferred effect throwing does not stop the rest.
