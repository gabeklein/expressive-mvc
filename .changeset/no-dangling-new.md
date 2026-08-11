---
'@expressive/mvc': minor
---

A `State` constructed with plain `new` must activate before the end of the tick - by `State.new()`, adoption by an owner, or placement with `new Context(state)`. One that does not now warns, naming the instance and the three remedies. `set(null)` releases an instance you decide against, exempting it.

This makes an existing tacit rule enforceable. A bare `new` that nothing adopts produced an inert instance whose instructions never ran and whose properties were never managed, with no signal at all - the same deadline, wired in as a probe, is what found the `set()` factory adoption bug fixed in #324.

Two defects surfaced by the invariant are fixed alongside it:

Destroying a `State` that never activated threw instead of releasing it. Terminal dispatch synthesized the activation signal for a never-ready instance, running its init against an already-terminated observer.

```ts
const state = new MyState();
state.set(null); // threw: "was destroyed - cannot be rendered, watched or updated"
```

A host constructs a `Component` per render attempt, and the constructor resolves duplicates by props object - returning the first instance and abandoning the second. That twin never activated and was never released, so it outlived the render attempt which created it. Under React StrictMode this happened on every mount.

Deferring activation past the tick is no longer supported. `new Context(state)` still claims a home before activation locks it to root, but the placement must happen in the same tick as construction.
