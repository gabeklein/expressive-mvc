---
'@expressive/mvc': patch
---

Instructions work again on React Native. The token registry is now a plain `Map` cleared at the end of each tick, so no `WeakMap` is ever keyed by a symbol - Hermes does not implement ES2023 symbol keys for `WeakMap`, and keying on one made every instruction throw. This supersedes the `WeakMap` introduced to stop unconsumed tokens retaining their factories; a per-tick registry bounds that retention instead.

Creating an instruction outside a construction now throws:

```ts
const shared = set(() => 42); // Error - no State under construction
```

An instruction is per-instance, so a token minted ahead of one had no possible claimant - it was consumed by whichever instance activated first, leaving every later instance with the raw symbol. This is sound only because a State must now activate in the tick it was constructed.
