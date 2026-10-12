# `state.get()` - Read & Subscribe

Instance method for reading values, running effects, checking status, and fetching from context - every read-side operation on one verb, dispatched on the first argument's kind (property key, effect function, `null`, State class), each form individually typed (see [design.md](../design.md)).

## Overloads

### Export all values

```ts
get(): State.Values<this>
```

Returns a frozen plain object of all managed values - including non-enumerable `set()` / `ref` fields; lazy factories and computeds appear once computed. Recursively exports child states; exotic values (ref, etc.) unwrap via their `.get()`. Circular references (parent/child loops) return the same exported object.

```ts
const values = state.get();
// { count: 0, name: 'World', child: { value: 'foo' } }
```

### Get single property

```ts
get<T extends State.Event<this>>(key: T, required?: boolean): State.Value<this, T>
```

Returns the underlying value; exotic values like `ref.Object` unwrap via `.get()`.

- A key with no stored value yet (e.g. unset `set<T>()`) throws a suspense-compatible `Promise`/`Error` unless `required` is `false`. A stored `undefined` throws only when `required` is `true`.
- A method name returns the unbound (original) method, not the auto-bound one.

```ts
state.get('count'); // value
state.get('foo', true); // throws suspense if undefined
state.get('foo', false); // undefined, never suspends
state.get('method'); // unbound method
```

### Tracked effect

```ts
get(effect: State.Effect<this>): State.Release
get<R>(effect: State.Effect<this, R>): State.Release<Awaited<R>>
```

Runs `effect` immediately, then again whenever accessed properties change. Returns an unsubscribe function, also awaitable (see **Await the release**).

```ts
const stop = state.get((current, update) => {
  // `this` = state instance
  // `current` = tracking proxy - reads create subscriptions
  // `update` = readonly array of changed keys (empty on first run, undefined before ready)
  console.log(current.count);
});
```

**Tracking:**

- Only reads via the `current` proxy subscribe - not via `this` or method calls.
- Nested child state properties track deeply (`current.child.value`); replacing a child re-subscribes to the new one.
- `current.get(Type)` and `current.get(State)` track the same way - reads off the fetched State subscribe.
- Simultaneous updates to several tracked properties produce one re-run.

**Effect return value:**

- `(event) => void` - cleanup, called with `true` (about to re-run), `false` (cancelled via `stop()`), or `null` (state destroyed)
- `null` - cancel the effect (one-shot)
- `Promise` - the run is pending until it settles; the resolved value is treated as above (function → cleanup, `null` → cancel)

**Async effects:** tracked changes during a pending run do not re-run it - they accumulate, and one re-run follows settlement with every changed key in `update`. An async effect does not see intermediate states; sync effects remain the per-event tool. A rejection is reported like a sync throw (`catch` handlers, then uncaught); the effect then stays idle until cancelled. Cancel or destroy while pending: no re-run, a cleanup the run resolves to is called with `false` / `null`.

**Suspense:** an effect that throws a Promise (e.g. reading an unset `set<T>()`) - synchronously or after an `await` - pauses and retries when it resolves. While pending, updates to other tracked properties do not trigger re-runs.

**Before ready:** effects registered in constructors wait for activation before first run.

**Await the release:** `await state.get(effect)` cancels the effect and yields the value of its first clean run - a one-shot read of tracked state that suspends until it can complete.

- sync run already done - resolves at once with its output
- first run suspended - resolves after the replay that completes
- async run - resolves with what the promise resolves to; tracked changes in flight do not re-run it

```ts
const user = await state.get(($) => $.user);
const total = await state.get(async ($) => (await fetch($.url)).json());
```

Rejects if the state is destroyed first, or the run throws a non-suspense error (which then skips `catch` handlers). Calling the release by hand before it settles rejects a promise already attached, silent otherwise. Returning the release from an `async` function unwraps and cancels it - TS does not flag this.

To watch a specific property or event, use [`set(event, callback)`](set.md).

### Check destroyed

```ts
get(status: null): boolean
```

`true` if destroyed.

```ts
if (state.get(null)) console.log('state is dead');
```

### Destroy callback

```ts
get(status: null, callback: () => void): () => void
```

Runs `callback` on destruction. Returns unsubscribe.

```ts
const stop = state.get(null, () => console.log('destroyed'));
```

### Fetch from context

```ts
get<T extends State>(type: State.Type<T>, required?: true): T
get<T extends State>(type: State.Type<T>, required: boolean): T | undefined
```

Fetches a State of that type from context. Missing throws `"Could not find {Type} in context."`; pass `false` to get `undefined` instead.

```ts
const parent = child.get(ParentState);
const maybe = child.get(ParentState, false);
```

### Subscribe to context

```ts
get<T extends State>(type: State.Type<T>, callback: Context.Expect<T>, downstream?: boolean): () => void
```

Fires `callback` when a State of that type becomes available - immediately if already present. Searches both directions by default; `downstream: true` watches only children, `false` only parents.

### Owner

```ts
get(type: typeof State, required?: true): State
get(type: typeof State, required: boolean): State | undefined
get(type: typeof State, callback: (child: State) => void | (() => void), downstream: true): () => void
```

`State` is never in context - `get(State)` reads ownership instead. An instance's owner is the State that constructed it into a field, `has()` pool or `map()`; failing that, the State its nearest enclosing context was set up for - the Component rendering a host-mounted Component, `use()` instance or `<Provider>`. `<Component for={X}>` owns X. A root, or an instance already active when something held it, has none. Missing throws `"{state} has no owner."`; `false` returns `undefined`.

Ownership is fixed at activation: later holders, context pushes and field moves do not change it, and the value is not reactive. Context is where a State registers to be found; ownership is who constructed it - see [context.md](context.md#ownership-vs-context).

With a callback and `true`, runs per owned State - direct children only, not their descendants - current ones, then each as it activates. A returned function runs when that State is destroyed, including with its owner. Returns a stop function.

```ts
const owner = child.get(State);
const stop = scene.get(State, (node) => attach(node), true);
```

## Type Signatures

```ts
type Effect<T, R = EffectCallback | Promise<EffectCallback | null | void> | null | void> = (
  this: T,
  current: T,
  update: readonly State.Event<T>[] | undefined
) => R;

type EffectCallback = (update: boolean | null) => void;

type Release<R = void> = (() => void) & PromiseLike<R>;
```
