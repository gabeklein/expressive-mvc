---
'@expressive/mvc': patch
---

`new()` is read at activation, after the class bootstraps, so a `type` handler reshaping it applies to the first instance too. Its declared return now includes `Promise<void>`, which activation already handled.
