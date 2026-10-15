---
'@expressive/mvc': patch
---

`new()`'s declared return admits `Promise<void>`, so an `async new()` typechecks - activation already reported its rejection.
