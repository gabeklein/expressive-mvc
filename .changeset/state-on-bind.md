---
'@expressive/mvc': minor
---

`State.on({ bind })` runs each time a method binds to an instance - first read, assigned replacement, rebind after a hot patch - with the key and bound function. Returning `(args) => void` observes each call before it runs; a throw aborts the call.
