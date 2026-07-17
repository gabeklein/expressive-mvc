---
'@expressive/mvc': patch
'@expressive/react': minor
---

Prepare React-owned state during render but defer its `new()` lifecycle hook and ready signal until commit. Server-only and abandoned render attempts no longer start mount work, while ordinary `State.new()` remains synchronous.
