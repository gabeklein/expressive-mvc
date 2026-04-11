# `state.get()` - Read & Subscribe

Instance method on State for reading values, running effects, checking status, and fetching from context.

## Overloads

### Export all values

```ts
get(): State.Values<this>
```

Returns a frozen plain object with all enumerable property values. Recursively exports child states. Exotic values (ref, etc.) are unwrapped via their `.get()` method. Handles circular references (parent/child loops return the same exported object).

```ts
const values = state.get();
// { count: 0, name: 'World', child: { value: 'foo' } }
```

### Get property (async handle)

```ts
get<K extends State.Event<this>>(key: K): State.Pending<State.Value<this, K>>
```

With no second argument, returns a `Pending<T>` handle - a lightweight thenable with a synchronous `.current` peek. Use this to read a property without triggering suspense, or to await a value that may not be set yet.

```ts
// Sync peek - undefined if not set
const now = state.get('foo').current;

// Await first assignment
const value = await state.get('foo');

// Callback style (one-shot, no cleanup needed)
state.get('foo').then(value => { ... });
```

**Resolution semantics:**
- `.current` returns the value if set (non-undefined), or the unbound method for method keys, otherwise `undefined`. Never throws.
- `.then(resolve, reject?)` resolves immediately if the value is set, otherwise waits for the first assignment. Rejects if the state is destroyed before assignment.
- The thenable works with `await` directly - no wrapper needed.
- `.then` is one-shot - registers a listener that self-removes after first resolution.

Use this when ergonomic async access matters - e.g. in a `new()` lifecycle hook that needs to wait for a deferred value.

### Get property (sync)

```ts
get<T extends State.Event<this>>(key: T, required: boolean): State.Value<this, T>
```

With an explicit boolean second argument, returns the raw stored value synchronously. For exotic values like `ref.Object`, returns the unwrapped stored value (not the ref object).

- `required: true` - throws a suspense-compatible `Promise`/`Error` if the value is undefined. For method names, returns the unbound (original) method.
- `required: false` - returns the raw value even if `undefined`. Never throws.

```ts
state.get('foo', true);    // throws suspense if undefined
state.get('foo', false);   // value or undefined, never throws
state.get('method', true); // returns unbound method
```

### Tracked effect

```ts
get(effect: State.Effect<this>): () => void
```

Runs `effect` immediately, then re-runs whenever accessed properties change. Returns an unsubscribe function.

```ts
const stop = state.get((current, update) => {
  // `this` = state instance
  // `current` = tracking proxy - reads create subscriptions
  // `update` = readonly array of changed keys (empty array on first run, undefined before ready)
  console.log(current.count);
});
```

**Tracking behavior:**
- Only properties accessed via `current` proxy are tracked.
- Properties accessed via `this` or method calls do NOT create subscriptions.
- Nested child state properties are tracked deeply (e.g., `current.child.value`).
- Replacing a child state re-subscribes to the new child.
- Simultaneous updates to multiple tracked properties produce a single re-run.

**Return value from effect:**
- `(event) => void` - cleanup callback. Called with:
  - `true` - effect is about to re-run (dependency changed)
  - `false` - effect was manually cancelled (via `stop()`)
  - `null` - state was destroyed
- `null` - cancel the effect (one-shot)
- `Promise<void>` - ignored (no special behavior)

**Suspense in effects:**
If the effect throws a Promise (e.g., accessing an unset `set<T>()` property), the effect pauses. It retries when the Promise resolves. While pending, updates to other tracked properties do not trigger re-runs.

**Before ready:**
Effects registered in constructors wait for activation before first run.

### Watch single property

```ts
get<T extends State.Event<this>>(key: T, callback: State.OnUpdate<this, T>): () => void
```

Callback fires on every assignment to `key` that changes the value, and on explicit `set(key)` dispatches. Fires synchronously on each assignment (before flush). If callback returns a function, that function is called once when the batch settles.

```ts
const stop = state.get('count', (key, source) => {
  console.log('count changed:', source.count);
});
```

Also works for custom events:

```ts
state.get('myEvent', (key, source) => {
  console.log('custom event fired');
});
```

### Check destroyed

```ts
get(status: null): boolean
```

Returns `true` if state is destroyed, `false` otherwise.

```ts
if (state.get(null)) {
  console.log('state is dead');
}
```

### Destroy callback

```ts
get(status: null, callback: () => void): () => void
```

Registers a callback for when state is destroyed. Returns unsubscribe function.

```ts
const stop = state.get(null, () => console.log('destroyed'));
```

### Fetch from context (required)

```ts
get<T extends State>(type: State.Type<T>, required?: true): T
```

Fetches a State of the given type from context. Throws `"Could not find {Type} in context."` if not found.

```ts
const parent = child.get(ParentState);
```

### Fetch from context (optional)

```ts
get<T extends State>(type: State.Type<T>, required: boolean): T | undefined
```

Pass `false` to return `undefined` instead of throwing.

```ts
const maybe = child.get(ParentState, false);
```

### Subscribe to context

```ts
get<T extends State>(type: State.Type<T>, callback: Context.Expect<T>, downstream?: boolean): () => void
```

Subscribe to a State becoming available in context. Callback fires immediately if already available. Specify `downstream: true` to only watch children.

## Type Signatures

```ts
type Effect<T> = (
  this: T,
  current: T,
  update: readonly State.Event<T>[] | undefined
) => EffectCallback | Promise<void> | null | void;

type EffectCallback = (update: boolean | null) => void;

type OnUpdate<T, K> = (this: T, key: K, thisArg: K) => void;

interface Pending<T> {
  /** Sync peek - `undefined` if unset. Unbound method for method keys. */
  current: T | undefined;

  /** Resolves with current if set, else on first assignment. Rejects on destroy. */
  then(
    resolve: (value: T) => void,
    reject?: (reason: unknown) => void
  ): void;
}
```
