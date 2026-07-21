# `state.get()` - Read & Subscribe

Instance method on State for reading values, running effects, checking status, and fetching from context.

All read-side operations share this one verb so the library's instance surface stays at two methods (`get`/`set`), leaving the rest of the namespace to the model's own fields. Overloads dispatch on the kind of the first argument - property key, effect function, `null`, State class - and each form is individually typed (see [design.md](../design.md)).

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

### Get single property

```ts
get<T extends State.Event<this>>(key: T, required?: boolean): State.Value<this, T>
```

Returns the underlying value for a property. For exotic values like `ref.Object`, returns the unwrapped value (calls `.get()`).

- If value is undefined and `required` is not `false`, throws a suspense-compatible `Promise`/`Error`.
- If value is a method name, returns the unbound (original) method rather than the auto-bound version.

```ts
state.get('count'); // get value
state.get('foo', true); // throws suspense if undefined
state.get('foo', false); // returns undefined without suspense
state.get('method'); // returns unbound method
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

To watch a specific property or event, use [`set(event, callback)`](set.md).

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
```
