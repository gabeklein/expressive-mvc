---
'@expressive/mvc': patch
---

Fix `State.on()` handlers being silently skipped when an anonymous class sits in the prototype chain.

Bootstrap walked the chain until it hit a class with a falsy `name`, which terminated correctly only because `Object.getPrototypeOf(State)` is `Function.prototype`. Any intermediate class with an empty `name` ended the walk early and every ancestor above it was dropped - their per-class `type` hooks, per-instance `before`/`after` setup, and the teardowns those return never ran, with no error.

The ordinary mixin idiom produces exactly that: a class expression which is returned or passed rather than assigned gets no inferred name.

```ts
const Timestamped = (Base) => class extends Base { stamp = Date.now() };

class Doc extends Timestamped(State) {}   // handlers on State were lost
```

The walk now ends on `State` itself rather than on a name check.
