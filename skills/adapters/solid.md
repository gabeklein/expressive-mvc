### Key difference: signal getters

Properties are wrapped as Solid signals. Accessing them requires calling as functions:

```ts
// React / Preact
const { name, age } = MyState.use();
console.log(name, age); // direct values

// Solid
const { name, age } = MyState.use();
console.log(name(), age()); // must call as signal getters
```

### API surface

Mirrors `@expressive/react` where it maps onto Solid:

- `State.use(...args)` - creates instance, pushes it onto ambient context (so
  `get()` instructions resolve parents/peers), destroys it on `onCleanup`.
  Supports constructor args / assign objects and the `use()` interception
  method - called once at setup, since Solid components do not re-render.
- `State.get()` / `get(false)` / `get(true)` - context lookup returning the
  reactive proxy; `false` is optional (undefined when missing), `true` makes
  accessors throw when their value is undefined (non-suspense analog of
  react's requireValues).
- `State.get((current, refresh) => value)` - factory/effect form built on
  `watch`. Returns an accessor; re-computes when accessed properties change.
  Promise results resolve via signal: accessor is `null` while pending, then
  the value (or throws the rejection). `refresh` notifies subscribers, also
  before/after a passed promise or async function.
- `use(instance)` - subscribe to an externally-owned observable; activates it
  if unready, never destroys it.
- `<Provider for={...}>` - accepts class, instance, or map; `is` callback;
  rest props assign to the provided instance reactively.
- `<Consumer for={Type}>{(proxy) => ...}</Consumer>` - render function
  receives the reactive proxy.
- Re-exports: `Context`, `Observable`, `def`, `get`, `ref`, `set`, `hot`.

Not ported: Suspense integration (async is modeled with signals instead) and
the `Component` class bridge.

### Implementation

Uses WeakMap caches + Proxy:

- One proxy and one update listener exist per instance - repeat calls reuse
  them, so there are no duplicate subscriptions and nothing leaks (listener
  detaches when the instance is destroyed; caches are weakly held)
- Each property gets a `createSignal()` on first access
- Proxy get trap returns signal getter function; writes pass through to the
  instance
- Methods and inherited State members pass through unchanged

### Reactive type

```ts
type Reactive<T extends State> = {
  [P in keyof T]: P extends keyof State
    ? T[P] // State methods unchanged
    : T[P] extends (...args: any) => any
      ? T[P] // Functions unchanged
      : Accessor<T[P]>; // Properties become signal getters
};
```

Available as `State.Reactive<T>` from `@expressive/solid`.
