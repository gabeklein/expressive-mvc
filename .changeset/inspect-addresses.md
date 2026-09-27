---
'@expressive/inspect': minor
---

A label shared by more than one class (two modules each declaring `class Control`) now throws from `find`, `get`, `set`, `call` and `act`'s `until` instead of silently picking the first instance of either. The error lists the classes' `typeId`s; address by instance id or owner path, or give one a distinct `label()`.

`get(address, select)` reads a selection - `{ status: true, control: { value: true } }` - as one consistent snapshot: selected keys only, descending through child States (which keep `$ref`), Maps, objects and each element of a list. Also on the bridge and relay.
