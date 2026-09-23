# `set` - Default Values, Factories & Validation

Runnable source: [`set`](https://expressive.dev/examples/instructions/set) (default + callback), [`set-factory`](https://expressive.dev/examples/instructions/set-factory) and [`set-computed`](https://expressive.dev/examples/instructions/set-computed) - complete programs, served as HTML.

```ts
import { set } from '@expressive/mvc';
```

> React apps import these from `@expressive/react` - the adapter re-exports every instruction. Examples below show the core import; do not add `@expressive/mvc` to a React app's `package.json`.

Instruction for managed slots: defaults, placeholders, lazy/async factories, validation callbacks.

All `set()` forms are **non-enumerable** - hidden from `Object.keys()`, spread, and `ref(this)`, unlike plain assignment (`name = 'foo'`) - except the [computed](#computed-reactive) form, enumerable to match a getter. Factory forms are **read-only** unless paired with a callback; value forms are writable.

## Overloads

### Placeholder (Suspense)

```ts
class MyState extends State {
  data = set<string>();
  logged = set<string>(undefined, (next, prev) => {
    console.log('assigned:', next);
  });
}
```

Required, initially undefined. Reading before assignment throws a suspense-compatible `Promise`/`Error` hybrid. Writable.

### Default Value

```ts
class MyState extends State {
  name = set('default');
}
```

Writable; unlike `name = 'default'`, hidden from `Object.keys()` and `ref(this)`.

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

Callback runs on every assignment:

| Callback does       | Effect                                     |
| ------------------- | ------------------------------------------ |
| throws `false`      | reject - value unchanged, no event         |
| throws `true`       | accept silently - value changes, no event  |
| returns a function  | cleanup, called on next update with the new value |
| returns a promise   | ignored                                    |
| throws an error     | rethrown to the caller                     |

### Factory

```ts
class MyState extends State {
  config = set(() => loadConfig()); // lazy, read-only
  api = set(async () => fetchData()); // async, suspends until resolved
  data = set(() => fetchData(), true); // eager, runs immediately
  maybe = set(() => fetchData(), false); // lazy, no suspense (undefined while pending)
}
```

Zero-argument factory, computed lazily on first access. Read-only.

- Async factories throw suspense on access until resolved.
- `false`: `undefined` while pending instead of suspending.
- `true`: runs immediately on init; suspends if async.
- Bound to the instance (`this` works).
- May suspend on other pending `set()` properties - resolution cascades.

Suspense via factory fits load-once data a view cannot render without. Keep explicit `loading` / `error` fields when the operation is user-initiated (submit, refresh), stale content stays visible during refetch, or errors render inline rather than thru a boundary.

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

Writable. Callback runs on factory resolution and on manual assignment.

### Computed (Reactive)

```ts
class MyState extends State {
  first = 'John';
  last = 'Doe';
  full = set(self => `${self.first} ${self.last}`); // re-runs when first/last change
}
```

The instruction equivalent of a getter. A function **declaring a parameter** routes into the compute engine - re-running whenever a managed property it reads updates - where a zero-arg factory runs once and caches. The instance is passed as both `this` and the first argument, so arrow and regular functions both work.

- **Dispatch is by arity.** `set(() => x)` is a one-shot factory; `set(self => x)` is reactive. A function reading via `this` still must declare the parameter (`set(function (self) { return this.x })`).
- Enumerable and read-only, like a prototype getter. Computes lazily on first access; in snapshots once accessed.
- Being instruction-assigned rather than a concrete getter, a **subclass can refine its type** with `declare` (e.g. narrowing a parent's generic computed) - which a parent getter cannot express.

### Direct Promises Are Not Supported

```ts
class MyState extends State {
  data = set(somePromise); // TypeError at init
}
```

A raw Promise throws `Direct promises are not supported in set(...)`. Use a factory (`set(() => promise)` or `set(async () => value)`) so async work starts during activation/access - a promise constructed in a field initializer can keep running for instances React abandons, especially under StrictMode.

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
