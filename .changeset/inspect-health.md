---
'@expressive/inspect': minor
'@expressive/mvc': patch
---

`health()` replaces `warnings()`: `{ orphans, collected, copies, caught }`.

- `copies` counts loaded copies of `@expressive/mvc` - each copy adds its `State` to `globalThis[Symbol.for('@expressive/mvc')]` the first time it constructs a State. More than one means inspect sees only its own copy's States; it warns once.
- `caught` counts `Caught` reports by case, including ones an app handler goes on to handle - inspect's `catch` joins each class as its first instance activates, ahead of app handlers registered before then. Inspect passes each report on, so behavior is unchanged. With the journal recording, each report is also a `caught` event carrying `{ case, message, stack, handled }` at any level; `summary()` counts them per instance. `journal.clear()` also zeroes the counts.

Inspect now needs the `@expressive/mvc` release that ships `Caught` - upgrade them together.
