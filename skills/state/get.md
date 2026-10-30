# `state.get()` - Read & Subscribe

Instance method for reading values, running effects, checking status, and fetching from context - every read-side operation on one verb, dispatched on the first argument's kind (property key, effect function, `null`, Model class), each form individually typed (see [design.md](../design.md)).

## Overloads

### Export all values

```ts
get(): Model.Values<this>
```

Returns a frozen plain object of all managed values - including non-enumerable `set()` / `ref` fields; lazy factories and computeds appear once computed. Recursively exports child instances; exotic values (ref, etc.) unwrap via their `.get()`. Circular references (parent/child loops) return the same exported object.

```ts
const values = state.get();
// { count: 0, name: 'World', child: { value: 'foo' } }
```

### Get single property

```ts
get<T extends Model.Event<this>>(key: T, required?: boolean): Model.Value<this, T>
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
get(effect: Model.Effect<this>): Model.Release
get<R>(effect: Model.Effect<this, Promise<R>>): Model.Release<R>
```

Runs `effect` immediately, then again whenever accessed properties change. Returns an unsubscribe function, also awaitable (see **Await the release**).

```ts
const stop = state.get((current, update) => {
  // `this` = instance
  // `current` = tracking proxy - reads create subscriptions
  // `update` = readonly array of changed keys (empty on first run, undefined before ready)
  console.log(current.count);
});
```

**Tracking:**

- Only reads via the `current` proxy subscribe - not via `this` or method calls.
- Nested child instance properties track deeply (`current.child.value`); replacing a child re-subscribes to the new one.
- `current.get(Type)` and `current.get(Model)` track the same way - reads off the fetched instance subscribe. `current.get(Type)` also follows its provider (see [Fetch from context](#fetch-from-context)).
- Simultaneous updates to several tracked properties produce one re-run.

**Effect return value:**

- `(event) => void` - cleanup, called with `true` (about to re-run), `false` (cancelled via `stop()`), or `null` (instance destroyed)
- `null` - cancel the effect (one-shot)
- `Promise` - the run is pending until it settles; the resolved value is a value only, never a cleanup or cancel

**Async effects:** tracked changes during a pending run do not re-run it - they accumulate, and one re-run follows settlement with every changed key in `update`. An async effect does not see intermediate states; sync effects remain the per-event tool. A rejection is reported like a sync throw (`catch` handlers, then uncaught); the effect then stays idle until cancelled. Cancel or destroy while pending: no re-run.

**Suspense:** an effect that throws a Promise (e.g. reading an unset `set<T>()`) - synchronously or after an `await` - pauses and retries when it resolves. While pending, updates to other tracked properties do not trigger re-runs.

**Before ready:** effects registered in constructors wait for activation before first run.

**Await the release:** `await state.get(effect)` cancels the effect once it settles and yields the latest clean run - a one-shot read of tracked state that suspends until it can complete. Only an async effect yields a value; a sync one resolves `undefined`, its cleanup called with `false`.

- idle - resolves at once with the latest run
- run in flight, queued, or suspended - waits for it; a change arriving meanwhile re-runs first

```ts
const user = await state.get(async ($) => $.user);
const total = await state.get(async ($) => (await fetch($.url)).json());
```

Rejects if the instance is destroyed before any clean run, or a run throws a non-suspense error (which then skips `catch` handlers). Calling the release by hand before it settles rejects a promise already attached, silent otherwise. Returning the release from an `async` function unwraps and cancels it - TS does not flag this.

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
get<T extends Model>(type: Model.Type<T>, required?: true): T
get<T extends Model>(type: Model.Type<T>, required: boolean): T | undefined
get<C extends Model.Extends>(type: C, key, ...rest): instance of C // forwarded to C.get
```

Calls `Type.get(...args)` with this instance as origin: the lookup searches this instance's context, skipping itself, and a tracking proxy subscribes to the result. Missing throws `"Could not find {Type} in context."`; pass `false` to get `undefined` instead. A class overriding static `get` receives its own arguments ([Static get](#static-get)).

Through a tracking proxy (effect, `render()`) the lookup follows the context it ran in - a closer provider arriving or the found one leaving re-runs it; placing the instance into a context later does not. A required lookup whose provider leaves throws: destroy consumers before providers, or pass `false`.

```ts
const parent = child.get(Parent);
const maybe = child.get(Parent, false);
const user = session.get(User, 5); // User.get(5) from session's context
```

### Subscribe to context

```ts
get<T extends Model>(type: Model.Type<T>, callback: Context.Expect<T>, downstream?: boolean): () => void
```

Fires `callback` when an instance of that type becomes available - immediately if already present. Searches both directions by default; `downstream: true` watches only children, `false` only parents.

### Owner

```ts
get(type: typeof Model, required?: true): Model
get(type: typeof Model, required: boolean): Model | undefined
get(type: typeof Model, callback: (child: Model) => void | (() => void), downstream: true): () => void
```

`Model` is never in context - `get(Model)` reads ownership instead. An instance's owner is the instance that constructed it into a field, `has()` pool or `map()`; failing that, the instance its nearest enclosing context was set up for - the Component rendering a host-mounted Component. `<Component for={X}>` owns X. A root, or an instance already active when something held it, has none. Missing throws `"{state} has no owner."`; `false` returns `undefined`.

Ownership is fixed at activation: later holders, context pushes and field moves do not change it, and the value is not reactive. Context is where an instance registers to be found; ownership is who constructed it - see [context.md](context.md#ownership-vs-context).

With a callback and `true`, runs per owned instance - direct children only, not their descendants - current ones, then each as it activates. A returned function runs when that instance is destroyed, including with its owner. Returns a stop function.

```ts
const owner = child.get(Model);
const stop = scene.get(Model, (node) => attach(node), true);
```

## Static get

```ts
Model.get(): T                  // required; throws if not in context
Model.get(false): T | undefined // optional
```

Context lookup from wherever it is called. Inside a host render (React, dom) the host supplies context and subscribes to reads. Through `state.get(Type)` or the `get` instruction it reads that instance's context, hosts uninvolved ([context.md](context.md#static-context)); elsewhere the root context, untracked. Function arguments are not accepted.

### Overriding

```ts
class User extends Model {
  id = 0;

  static get<T extends User>(this: Model.Extends<T>, id?: T['id'] | false): T {
    if (typeof id != 'number') return (id === false ? super.get(false) : super.get()) as T;

    return Context.get(this, (context) => context.get(Directory).find(id) as T);
  }
}

User.get(5);             // in render: tracked
User.get(false);         // base form through super
session.get(User, 5);    // from session's context
class Order extends Model {
  buyer = get(User, 5);  // from the owner's context, once ready
}
```

- Handle own keys; delegate base forms with `super.get(arg)` - `get()` and `get(false)` keep their meaning. `super` from a static `get` is ordinary inheritance - call each base form separately, since `false | undefined` matches no single base overload.
- Each call reaches `Context.get(this, compute)` exactly once, synchronously - directly or through `super.get` - for context and tracking in every call form ([context.md](context.md#static-context)). `this` is always the class.
- `compute(context, from?)` returns the result; `from` is the calling instance for the instance and instruction forms. A returned Model is tracked - by the host in render, through `from` when it is a tracking proxy.
- In `compute`, use only `context.get(Type, required?)` - other members of `context` are unstable.
- In render or through a tracking proxy, every `context.get` in `compute` follows context - `context.get(Connection).reference(this, id)` re-runs when `Connection`'s provider changes, as `User.get()` does for `User`.
- Outside render - event handlers, effects, module code - a static `get` resolves from root, untracked, on every host; so does a plain `Other.get()` inside `compute`, except under the instance and instruction forms, which keep it on the caller's context.
- One signature, typing a key from `T` (`T['id'] | false`) - inference from overloads uses the last, and `get()` and `get(false)` stay callable - a plain `key?: string` fails the static-side check against base `get`. Through `state.get(Type, ...)` and the `get(Type, ...)` instruction, arguments type against the base, not a narrowed override.

## Type Signatures

```ts
type Effect<T, R = EffectCallback | Promise<void> | null | void> = (
  this: T,
  current: T,
  update: readonly Model.Event<T>[] | undefined
) => R;

type EffectCallback = (update: boolean | null) => void;

type Release<R = void> = (() => void) & PromiseLike<R>;
```
