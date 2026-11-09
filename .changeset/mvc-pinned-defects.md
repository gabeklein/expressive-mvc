---
"@expressive/mvc": patch
---

Fix four filed defects:
- A `set()` callback now runs with the instance as `this`.
- `Context.get` prefers an explicit entry even after two implicit ones of the same type.
- A cleanup returned from a `Context.get` callback for an instance already registered now runs when that instance is removed.
- Adding a destroyed Model to a `has()` pool or `map()` throws without inserting it or releasing what it would replace.
