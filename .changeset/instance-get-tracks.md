---
'@expressive/mvc': patch
---

`get(Type)` and `get(State)` called on a tracking proxy - an effect's `current`, a Component's render `this` - return a tracked State, so reads off it subscribe like a `get(Type)` field. `state.get(Type)` is typed as `Type` again, not `State`.
