# `state.set()` - Write & Listen

Instance method for writing values, dispatching events, listening to updates, destroying state, and defining properties - every write-side operation on one verb, dispatched on the first argument's kind, each form individually typed (see [design.md](../design.md)).

## Overloads

### Await pending flush

```ts
set(): State.Updated<this>
```

Returns a promise-like array of keys updated in the current batch, resolving when the flush completes - an empty array if no update is outstanding. Also activates a state created with `new` (not `State.new()`).

This is one state's next flush. To wait on the whole cascade a write sets off - every subscriber, including readers of other states - use `pending(work)` ([state.md](state.md#presentation-transitions)).

```ts
const updated = await state.set();
// ['foo', 'bar'] - keys that changed
```

### Merge values

```ts
set(assign?: State.Assign<this>, silent?: boolean): State.Updated<this>
```

Merges an object into state. Only known properties and methods apply; unknown keys and `is` are ignored.

So `set(values)` is the wire-snapshot ingest: a host payload may be a superset - extra keys drop, missing keys stay untouched. `undefined` / `null` present in the bag *do* write, so don't pad. On a subclassable class the ingest call is `this.set(msg.values as State.Assign<Session>)` (cast below); never hand-roll an `apply()`/`pick` loop over declared fields.

```ts
state.set({ count: 5 }); // merge, triggers events
state.set({ count: 5 }, true); // silent - no events, no report if destroyed (useful in teardown)
```

Methods can be replaced:

```ts
state.set({
  method() {
    return this.value + 1; // `this` is bound
  }
});
```

#### What `Assign<this>` checks

`Assign<T>` is `Record<string, unknown> & { [K in Field<T>]?: ... }`. The intersection means **unknown keys are not rejected** at the type level (ignored at runtime); the only call-site protection is **value-type-correctness of declared fields**:

```ts
state.set({ count: 'no' }); // error - count is a number
state.set({ kount: 5 });    // type-checks - unknown key, ignored at runtime
```

#### Self-calls under polymorphic `this`

`this.set({ field }, ...)` inside a **subclassable class** fails to type-check:

```ts
class Base extends State {
  path = '/';
  go() {
    this.set({ path: '/x' }, true);
    //        ^ Type '{ path: string }' is not assignable to 'Assign<this>'
  }
}
```

In the class body `this` is polymorphic, so `this[K]` is unresolved and TS cannot verify the literal's value types - the *only* thing `Assign<this>` enforces. Every `keyof this`-based alternative fails identically (a generic-inferred parameter, `Partial<Values<this>>`, even keyed `set('path', v)` - the literal isn't provably `keyof this`).

Cast to the concrete class - it loses **no real safety**, since the bypassed check was never available under polymorphic `this`:

```ts
(this as Base).set({ path: '/x' }, true);
```

A TypeScript limitation (mapped types over polymorphic `this`), not an mvc bug. External callers on a concrete instance (`base.set({ path })`) type-check normally. No looser parameter type can both accept the literal *and* value-check it while `this` is unresolved, so the cast is the idiomatic escape hatch.

### Listen to updates

```ts
set(callback: State.OnEvent<this>): () => boolean
```

Fires synchronously for every assignment that changes a value and every explicit event dispatch, with `(key, source)` - key a string, number, or symbol. Returns unsubscribe (`true` if removed, `false` if already inactive).

```ts
const stop = state.set((key, source) => {
  console.log('updated:', key);
});
```

- Return a function to run it once when the batch settles (deduped across assignments in the same tick); if it throws, the error is logged.
- Return `null` to unsubscribe.

### Dispatch event

```ts
set(key: State.Event<this>): State.Updated<this>
```

Dispatches an event without changing any value - for internal changes (e.g. array mutation) or custom events.

```ts
state.set('count'); // force update event for 'count'
state.set('myEvent'); // custom string event
state.set(Symbol('ev')); // symbol event
state.set(42); // number event
```

### Destroy

```ts
set(status: null): void
```

Terminates the state: children destroyed first (inner-to-outer), listeners notified with `null`, cleanups run, state frozen. Afterward, assignment is dropped and reported as `Caught.Destroyed`; silent `set(assign, true)` drops without a report. Full order: [lifecycle.md](lifecycle.md#destruction).

```ts
state.set(null);
```

### Listen to specific event

```ts
set<K extends State.Event<this>>(event: K | null, callback: State.OnEvent<this>): () => boolean
```

Callback for one property key or event; `null` listens for destruction. Return `null` from the callback to unsubscribe after the first call.

```ts
const stop = state.set('count', (key, source) => {
  console.log('count changed');
});

state.set(null, (key, source) => {
  console.log('destroyed');
});
```

### Define property (descriptor)

```ts
set<K extends State.Event<this>>(key: K, config: State.Define<this, K>): State.Updated<this>
```

Defines or updates a managed property from a descriptor. On an already-managed property only `value` is accepted (other fields throw); a missing property is created fully reactive and trackable.

```ts
state.set('foo', { value: 'bar' }); // update value (bypasses setter)
state.set('bar', { value: 'hello', set: false }); // read-only property
state.set('baz', { value: 'hidden', enumerable: false }); // non-enumerable property
state.set('child', { value: new ChildState() }); // registers child state
```

| Field        | Meaning                                                       |
| ------------ | ------------------------------------------------------------- |
| `value`      | initial or updated value                                      |
| `get`        | custom getter, `true` (required/suspense), or `false` (optional) |
| `set`        | custom setter, or `false` (read-only)                         |
| `enumerable` | appears in `Object.keys()` (default `true`)                   |

## Type Signatures

```ts
type OnEvent<T extends State> = (
  this: T,
  key: Signal<T>,
  source: T
) => void | (() => void) | null;

type Assign<T> = Record<string, unknown> & {
  [K in Field<T>]?: T[K] extends (...args: infer A) => infer R
    ? (this: T, ...args: A) => R
    : T[K];
};

type Updated<T extends State> = readonly Event<T>[] &
  PromiseLike<readonly Event<T>[]>;

type Apply<T = any> = {
  value?: T;
  get?: ((source: State) => T) | boolean;
  set?: Setter<T> | boolean;
  enumerable?: boolean;
};
```
