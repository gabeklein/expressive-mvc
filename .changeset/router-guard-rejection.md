---
"@expressive/router": patch
---

A function `redirect` guard that rejects now reaches the Route's `catch` after an in-app navigation, instead of leaving the current page held with the error dropped.
