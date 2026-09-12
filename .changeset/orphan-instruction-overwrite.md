---
"@expressive/mvc": patch
---

A child State a base-class initializer constructed no longer warns that it was never activated when a subclass initializer replaces it with an instruction (`get`, `ref`, `set`). An instruction records the States pending when it was created; applying it drops those constructed after its owner, which came from the owner's own initializers.
