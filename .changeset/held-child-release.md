---
'@expressive/mvc': patch
---

A State child assigned to a field before its owner joined a context is now dropped from that context when the field is cleared or reassigned. Previously it stayed resolvable there.
