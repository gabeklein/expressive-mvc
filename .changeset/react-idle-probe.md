---
'@expressive/react': minor
---

`Context.get()` outside a render no longer calls into React's hooks. React's development build logged "Invalid hook call" for it before any render, and on the server between renders. The adapter `Runtime` gains a required `idle(): boolean | undefined` - `true` when the host is certainly not rendering, `undefined` when it cannot tell, in which case the hook probe runs as before. React reads its dispatcher; Preact returns `undefined`.
