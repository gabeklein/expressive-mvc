---
'@expressive/mvc': minor
---

`State.on({ bind, call })` for tooling: `bind` runs each time a method binds to an instance (first read, assigned replacement, rebind after a hot patch) with the key and bound function; `call` runs before every method call with the key and arguments, and a throw aborts the call. Classes without a `call` handler keep native binding.
