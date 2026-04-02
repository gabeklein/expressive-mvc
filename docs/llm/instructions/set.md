# `set` - Computed Values, Factories & Validation

```ts
import { set } from '@expressive/state';
```

The most versatile instruction. All `set()` properties differ from plain assignment (`= value`) in their enumerable and writable behavior.

## Property Descriptor Policy

| Form                     | Enumerable | Writable | Description                                  |
| ------------------------ | ---------- | -------- | -------------------------------------------- |
| `= "foo"`                | yes        | yes      | Plain data property                          |
| `= set("foo")`           | no         | yes      | Managed value, excluded from snapshots/ref   |
| `= set("foo", cb)`       | no         | yes      | Managed value with setter callback           |
| `= set(() => "foo")`     | no         | no       | Factory-initialized, read-only               |
| `= set(() => "foo", cb)` | no         | yes      | Factory with setter callback                 |
| `= set((self) => ...)`   | yes        | no       | Reactive computed, included in snapshots/ref |

- **Enumerable** determines if the property appears in `Object.keys()`, `get()` snapshots, and `ref(this)`.
- **Writable** determines if the property can be assigned to. Read-only properties throw on assignment.
- Only reactive computed properties are enumerable because they are derived data.
- A property is writable if a setter callback is provided, or if initialized with a non-function value.

## Overloads

### Placeholder (Suspense)

```ts
class MyState extends State {
  data = set<string>();
}
```

Required property, initially undefined. Accessing before assignment throws a suspense-compatible `Promise`/`Error` hybrid. Writable. Non-enumerable.

With callback:

```ts
class MyState extends State {
  data = set<string>(undefined, (next, prev) => {
    console.log('assigned:', next);
  });
}
```

### Default Value

```ts
class MyState extends State {
  name = set('default');
}
```

Non-enumerable but writable. Unlike `name = 'default'`, excluded from snapshots and `ref(this)`.

### Default Value with Callback

```ts
class MyState extends State {
  name = set('default', (next, prev) => {
    if (next.length < 3) throw false; // reject update
  });

  query = set('', (value) => {
    const timer = setTimeout(() => search(value), 300);
    return () => clearTimeout(timer); // cleanup on next update
  });
}
```

Callback runs on every assignment. Behaviors:

- **Throw `false`**: reject the update (value unchanged, no event).
- **Throw `true`**: accept silently (value changes, no event).
- **Return a function**: cleanup called on next update with the new value.
- **Return a promise**: ignored (no special behavior).
- **Throw an error**: rethrows to caller.

### Factory

```ts
class MyState extends State {
  config = set(() => loadConfig()); // lazy, read-only
  api = set(async () => fetchData()); // async, suspends until resolved
  data = set(() => fetchData(), true); // eager, runs immediately
  maybe = set(() => fetchData(), false); // lazy, no suspense (undefined while pending)
}
```

Zero-argument factory. Computed lazily on first access (unless `true` passed). Read-only.

- Async factories throw suspense on access until resolved.
- `false` flag: returns `undefined` while pending instead of suspending.
- `true` flag: factory runs immediately on init, suspends if async.
- Factory is bound to the state instance (`this` works).
- Factories can suspend on other pending `set()` properties - resolution cascades.

### Factory with Callback

```ts
class MyState extends State {
  config = set(
    () => loadDefaults(),
    (next, prev) => {
      console.log('config changed');
    }
  );
}
```

Makes the property writable. Callback runs on both factory resolution and manual assignment.

### Reactive Computed

```ts
class MyState extends State {
  value = 10;
  doubled = set((from: this) => from.value * 2);
}
```

Distinguished from factory by having **one or more declared parameters** (checks `callback.length`). The first parameter receives a tracking proxy - only properties accessed through it create subscriptions.

- Enumerable (considered data). Read-only.
- Re-computes when any tracked dependency changes.
- Computations are lazy - deferred until accessed or until next flush.
- Accessing `from.value` subscribes; accessing `this.value` does not.
- Can reference own previous value via `from.ownProp` without infinite loop.
- Can be defined via method reference: `doubled = set(this.computeDoubled)`.
- Chained computed properties evaluate in declaration order.
- Included in snapshots and `ref(this)`.

### Direct Promise

```ts
class MyState extends State {
  data = set(somePromise);
}
```

Accepts a raw Promise. Suspends on access until resolved. On rejection, throws the rejection value.

## Type Signatures

```ts
function set<T>(value?: undefined, onUpdate?: set.Callback<T>): T;
function set<T>(factory: () => T | Promise<T>, required?: true): T;
function set<T>(factory: () => T | Promise<T>, required: boolean): T | undefined;
function set<T>(factory: () => T | Promise<T>, onUpdate: set.Callback<T>): T;
function set<T, S extends State>(factory: (self: S, key: string) => T | Promise<T>): T;
function set<T>(value: T | Promise<T>, onUpdate?: set.Callback<T>): T;

type set.Callback<T> = (this: State, next: T, previous: T) => ((next: T) => void) | Promise<any> | void | boolean;
type set.Reactive<T, S> = (self: S, property: string) => T;
type set.Factory<T, S> = (this: S, property: string) => Promise<T> | T;
```
