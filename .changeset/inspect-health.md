---
'@expressive/inspect': minor
'@expressive/mvc': patch
---

`health()` replaces `warnings()`: `{ orphans, collected, copies, caught }`.

- `copies` counts loaded copies of `@expressive/mvc` - each copy adds its `State` to `globalThis[Symbol.for('@expressive/mvc')]` the first time it constructs a State. More than one means inspect sees only its own copy's States; it warns once.
- `caught` counts reports reaching inspect's `State.on({ catch })` handler, by case. Inspect passes each report on, so behavior is unchanged. With the journal recording, each report is also a `caught` event carrying `{ case, message }`.
