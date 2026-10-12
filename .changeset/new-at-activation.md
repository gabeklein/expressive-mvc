---
'@expressive/mvc': patch
---

`new()` is read at activation, after the class bootstraps, so a `type` handler reshaping it applies to the first instance too. Its declared signature now matches what `State.Init` already accepts - parameters and a `Promise<void>` return - so a subclass may widen it.
