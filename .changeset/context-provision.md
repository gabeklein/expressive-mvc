---
'@expressive/mvc': patch
---

Context provision follows ownership.

- A Model's own lookups (`get` fields, `this.get(Type)`) start from its ownership chain, not from wherever it was first provided.
- `has` and `map` rows register with their owner like any owned child, held until the owner joins a context - they no longer land at root.
- `<Component for>` provides its target explicitly, so it outranks implicit providers of the same type above it.

