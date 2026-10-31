---
'@expressive/mvc': minor
---

`then` is a reserved key: a `then` field is unmanaged - non-enumerable, absent from `get()` and `Model.Values`, never notifying - and neither a `then` field nor method is overlaid by constructor args or `set({ ... })`. A class may make its instances thenable without that function becoming state.
