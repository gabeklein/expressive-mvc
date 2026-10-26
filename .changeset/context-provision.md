---
'@expressive/mvc': minor
---

Context provision follows ownership.

- A Model's own lookups (`get` fields, `this.get(Type)`) start from its ownership chain, not from wherever it was first provided.
- `has` and `map` rows register with their owner like any owned child, held until the owner joins a context - they no longer land at root.
- `<Component for>` provides its target explicitly; the stub itself is no longer provided, so `Component.get()` below it finds the enclosing Component.

**Breaking:**

- Assigning a Model owned elsewhere to a property no longer provides it from the assigner's context. To provide a reference, own it, render it with `<Component for={instance}>`, or add it to a context explicitly.
- Root no longer lets a later implicit provide evict an earlier one: two implicit providers of a type at root are ambiguous (`get(Type, false)` returns `null`), as in any other context. Globals sharing a base class no longer resolve that base.
