# `set` - Default Values, Factories & Validation

```ts
import { set } from '@expressive/mvc';
```

Versatile instruction for managed slots: defaults, placeholders, lazy/async factories, validation callbacks.

All `set()` forms are **non-enumerable** - excluded from snapshots, `Object.keys()`, and `ref(this)` - which distinguishes them from plain assignment (`name = 'foo'`). The one exception is the [computed](#computed-reactive) form, which is enumerable to match a getter. Forms initialized with a factory are **read-only** unless paired with a setter callback; forms initialized with a value are writable by default.

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

### Computed (Reactive)

```ts
class MyState extends State {
  first = 'John';
  last = 'Doe';
  full = set(self => `${self.first} ${self.last}`); // re-runs when first/last change
}
```

The instruction equivalent of a getter. Unlike a zero-arg factory (which runs once and caches), a function **declaring a parameter** routes into the reactive compute engine: it re-runs whenever any managed property it reads is updated. The instance is passed as both `this` and the first argument, so arrow functions and regular functions both work.

- **Dispatch is by arity.** `set(() => x)` is a one-shot factory; `set(self => x)` is reactive. A function that reads dependencies via `this` still needs to declare the parameter (`set(function (self) { return this.x })`) to be treated as computed.
- Enumerable and read-only, exactly like a prototype getter. Computes lazily on first access; included in snapshots once accessed.
- Because the slot is instruction-assigned rather than a concrete getter, a **subclass can refine its type** with `declare` (e.g. a parent declaring a generic computed property that subclasses narrow) - which a getter on the parent class cannot express.

### Direct Promises Are Not Supported

```ts
class MyState extends State {
  data = set(() => somePromise);
}
```

Do not pass a raw Promise to `set()`. Use a factory instead (`set(() => promise)` or `set(async () => value)`) so async work starts during activation/access. A promise constructed in a field initializer can keep running for instances React abandons, especially under StrictMode.

## Type Signatures

```ts
function set<T>(value?: undefined, onUpdate?: set.Callback<T>): T;
function set<T>(value: T, onUpdate?: set.Callback<T>): T;
function set<T>(factory: () => T | Promise<T>, required?: true): T;
function set<T>(factory: () => T | Promise<T>, required: boolean): T | undefined;
function set<T>(factory: () => T | Promise<T>, onUpdate: set.Callback<T>): T;
function set<T, S = any>(compute: (this: S, self: S) => T): T;

type set.Callback<T> = (this: State, next: T, previous: T) => ((next: T) => void) | Promise<any> | void | boolean;
type set.Factory<T, S> = (this: S, property: string) => Promise<T> | T;
```
