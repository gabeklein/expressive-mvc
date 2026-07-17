---
'@expressive/react': patch
---

Throw a direct error when a local `State.use()` value suspends instead of allowing React to discard and repeatedly recreate its owning hook state.
