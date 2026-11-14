---
"@expressive/mvc": patch
---

`await instance.set()` waits for an instance still settling - its async `new()`, setup or a parent's hold - before resolving, and rejects with the setup error if that destroys it, or if the instance is destroyed - before the call too. It used to resolve `[]` at once.
