---
'@expressive/router': patch
---

Re-run a function `redirect` guard when the route's own params change. Navigating `/vault/a` -> `/vault/b` on `vault/:doc` previously reused the first document's verdict; navigation below the route still reuses it.
