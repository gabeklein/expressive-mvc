---
'@expressive/dom': minor
---

Remove `Model.use()` from `@expressive/dom`. Function components own no state - put owned state on a class: a Component field, a Model element, or `<Component for={Type}>` above a function component that reads it with `Model.get()`. Per-render arguments become attributes, which assign fields. `use` is no longer a reserved member on rendered instances. `@expressive/react` keeps `Model.use()`.
