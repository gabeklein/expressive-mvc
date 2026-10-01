---
'@expressive/mvc': minor
---

`State.on({ bind, invoke })` for tooling: `bind` runs each time a method binds to an instance (first read, assigned replacement, rebind after a hot patch) with the key and bound function; `invoke` runs before every method call with the key and arguments, and a throw aborts the call. Classes without an `invoke` handler keep native binding.
