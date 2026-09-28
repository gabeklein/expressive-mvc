---
'@expressive/mvc': patch
---

A Component constructed twice for one element (React StrictMode) no longer returns the first instance from its constructor. Each construction is a full instance; whichever the host activates releases the other along with state its field initializers created. Fixes `#private` fields on Components throwing `Cannot initialize #x twice on the same object`, and field initializers running twice on the kept instance.
