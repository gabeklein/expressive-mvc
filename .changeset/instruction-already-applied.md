---
'@expressive/mvc': patch
---

An instruction token which cannot be applied now throws at activation instead of persisting as a value. A token minted outside a construction - hoisted to a module binding, or shared between classes - is consumed by whichever instance activates first, and every later instance silently kept the raw `Symbol('field-<uid>')` in place of its value.

```ts
const shared = set(() => 42);
class Thing extends State { value = shared }

Thing.new().value // 42
Thing.new().value // Symbol(field-WZJHFS) - now throws
```

A single-instance app shipped this and worked; the failure appeared only once a second instance was constructed.
