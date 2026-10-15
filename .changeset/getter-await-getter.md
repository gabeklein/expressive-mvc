---
'@expressive/mvc': patch
---

A getter reading a pending value - a `set()` placeholder, an async factory, or another getter waiting on one - now suspends on first read instead of returning `undefined`, and no longer warns "An exception was thrown while initializing" while it waits.
