---
'@expressive/mvc': patch
---

`new()` is read from the prototype when activation reaches it, so a `type` handler or a field initializer reshaping it applies to the first instance too. Its declared return now includes `Promise<void>`, which activation already handled.
