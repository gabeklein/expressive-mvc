---
'@expressive/mvc': minor
---

`state.get(Type, true)` and the `get(Type, true)` instruction through a tracking proxy return a strict view, as `Model.get(true)` does in render: reading an `undefined` field throws. Previously `true` only required the instance.
