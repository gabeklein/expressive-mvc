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
get(effect: State.Effect<this>): () => void
```

Runs `effect` immediately, then again whenever accessed properties change. Returns an unsubscribe function.

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
- Simultaneous updates to several tracked properties produce one re-run.

**Effect return value:**

- `(event) => void` - cleanup, called with `true` (about to re-run), `false` (cancelled via `stop()`), or `null` (state destroyed)
- `null` - cancel the effect (one-shot)
- `Promise<void>` - ignored

**Suspense:** an effect that throws a Promise (e.g. reading an unset `set<T>()`) pauses and retries when it resolves. While pending, updates to other tracked properties do not trigger re-runs.

**Before ready:** effects registered in constructors wait for activation before first run.

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

## Type Signatures

```ts
type Effect<T> = (
  this: T,
  current: T,
  update: readonly State.Event<T>[] | undefined
) => EffectCallback | Promise<void> | null | void;

type EffectCallback = (update: boolean | null) => void;
```
