---
'@expressive/mvc': patch
---

Context provision follows ownership.

- A Model's own lookups (`get` fields, `this.get(Type)`) start from its ownership chain, not from wherever it was first provided.
- `has` and `map` rows register with their owner like any owned child, held until the owner joins a context - they no longer land at root.
- `<Component for>` provides its target explicitly at its own level. An instance that was already provided above - by a field referencing it - no longer disappears from below the provider when that field is cleared.

