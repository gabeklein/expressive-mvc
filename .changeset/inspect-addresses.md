---
'@expressive/inspect': minor
---

A label shared by more than one class (two modules each declaring `class Control`) now throws from `find`, `get`, `set`, `call` and `act`'s `until` instead of silently picking the first instance of either. The error lists the classes' `typeId`s; address by instance id or owner path, or give one a distinct `label()`.
