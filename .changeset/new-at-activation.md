---
'@expressive/mvc': patch
---

`new()` is read when activation reaches it - an own non-enumerable method, else the prototype's - so a `type` handler or a field initializer reshaping it applies to the first instance too. An enumerable own `new` is a field, as before. Its declared return now includes `Promise<void>`, which activation already handled.
