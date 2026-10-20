---
'@expressive/react': patch
---

`Context.get()` outside a render no longer calls into React's hooks. React's development build logged "Invalid hook call" for it before any render, and on the server between renders.
