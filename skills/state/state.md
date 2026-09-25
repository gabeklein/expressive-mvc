# State - Core Class

```ts
import State from '@expressive/mvc';
```

`@expressive/mvc` - framework-agnostic reactive state built on classes.

## Creating State

```ts
class Counter extends State {
  count = 0;
  increment() {
    this.count++;
  }
}
```

### Instantiation

```ts
const counter = Counter.new(); // creates AND activates
const counter = Counter.new({ count: 10 }); // with initial values
```

> `new Counter()` constructs without activating. Use `Counter.new()` for a root instance. Bare `new` is correct for a child State declared on another State (the parent adopts and activates it), or to defer activation deliberately.

## Properties & Reactivity

Assign class fields normally. Any property write queues a batched update.

```ts
class App extends State {
  name = 'World';
  count = 0;
}

const app = App.new();
app.name = 'Alice'; // queues update
app.count = 1; // queues another - both flush via microtask
```

### Presentation Transitions

```ts
import { pending } from '@expressive/mvc';

await pending(() => {
  app.page = 'settings';
});
```

`pending(work)` runs `work` now, marks the updates it queues non-urgent, and resolves once every reader has absorbed them - see [Transitions](../react/component.md#transitions). Under React that waits for presentation, so a replacement that suspends holds the current screen instead of falling back. A free function, not a method: settlement comes from whichever readers the writes touch, each replaying through the scheduler it subscribed with.

- **No host registered:** no priority applies, but the promise still resolves once every subscriber has replayed - how headless code waits out a whole cascade, not just the first flush. Contrast `state.set()`, which resolves on the next flush of *that* state ([set.md](set.md)).
- **Nesting:** a nested call settles its own consequences and joins the outer call.
- **Suspending effect:** if an effect throws a promise, settlement waits for its retry and any downstream updates the retry causes. Pending updates arriving meanwhile join the same hold and squash into that retry. Fulfillment and rejection both retry through MVC dispatch; cancelling the effect or destroying its state releases the hold and prevents revival.
- **Errors:** an exception from `work` propagates synchronously; updates queued before it still dispatch. The promise never rejects - a reader throwing during replay is reported as `Caught.Effect` ([lifecycle.md](lifecycle.md#error-handling)), never to the writer, so no catch is needed.

`pending()` with no arguments is the reader half. Inside a replay carrying pending work it returns a release callback, and settlement waits on that instead of on the replay returning - how the React adapter holds until commit. A hand-written `watch` effect can do the same; elsewhere it returns `undefined`.

A promise returned by an effect stays ignored. To include other async work, claim during replay and release in `finally`:

```ts
watch(state, () => {
  const release = pending();
  animate().finally(release);
});
```

A renderer passes its non-urgent bracket as `watch`'s fourth argument. The bracket must invoke its callback synchronously; it assigns priority, it does not queue the replay.

### Value Equality

A write whose value `===` the previous one is skipped - no event.

### Property Iteration

```ts
for (const [key, value] of state) {
  // iterates managed properties
}
```

### Unmanaged Instance Data

Opaque handles (unsubscribe functions, timers, snapshots) are not reactive state: writes should neither notify nor throw thru the managed setter after destroy. TypeScript `private` does not opt out (any enumerable own field is managed); ES `#private` escapes management but re-initializes unsafely on Components. Define the field non-enumerable via `def`:

```ts
import State, { def } from '@expressive/mvc';

function put<T>(initial?: T): T {
  return def((key, self) => {
    Object.defineProperty(self, key, {
      value: initial as T,
      writable: true,
      enumerable: false,
      configurable: true
    });
  }) as T;
}

class Job extends State {
  progress = 0;                              // reactive
  unwatch = put<(() => void) | null>(null);  // unmanaged
}
```

The `def` factory returns void, so no managed property is applied. A destroyed instance is frozen - clean up before then: `const stop = this.unwatch; this.unwatch = null; stop?.();`. A handle only lifecycle touches is simpler as a `new()` closure variable.

## The `is` Property

Circular self-reference. Destructure it to keep instance access alongside values, usually aliased to the concept (`is: counter`, `is: form`) rather than a local named `is`.

```tsx
const Component = () => {
  const { is: counter, count } = Counter.use();

  return <button onClick={() => counter.count++}>{count}</button>;
};
```

Also for silent reads inside effects, or to guarantee the unwrapped instance: `state.is` is the instance whether or not `state` is a proxy. Idempotent (`state.is.is` is safe).

```ts
state.get((current) => {
  console.log(current.value); // subscribes to 'value'
  console.log(current.is.other); // silent read - no subscription
});
```

## Child States

Nest by direct assignment. Children are auto-parented, activated, and destroyed with the parent.

```ts
class Parent extends State {
  child = new ChildState(); // parented and activated when Parent initializes
}
```

- Replacing a child property destroys the old child if owned; non-owned children (assigned from outside) survive.
- Setting a child property to `null` destroys the owned child.

## Methods

Auto-bound on first access - safe to destructure.

```ts
const { increment } = Counter.new();
increment(); // `this` is bound
```

- Overwriting works: `test.method = () => 'bar'`.
- `super` calls work across inheritance chains.
- Methods never subscribe: what a method reads is untracked, whether it is called from an effect, a render, or a getter. To derive from another state, read its fields or getters - `thread.cwd()` inside a getter goes stale; a `get cwd()` does not.
- `this` inside a method is the instance, never a tracking proxy (`this === this.is`) - safe as a `Map`/`Set` key or for identity comparison, however the method was reached, including off a proxy handed to an effect or render. The `new()` hook has the same guarantee ([lifecycle.md](lifecycle.md#the-new-hook)).

## Static Methods

### `State.new()`

Creates and activates an instance. Takes `State.Args` - objects (initial values) and callbacks (lifecycle), processed in order; return handling in [Constructor Arguments](lifecycle.md#constructor-arguments).

```ts
const test = Test.new(
  { foo: 1 }, // initial values
  (self) => () => {}, // lifecycle callback; returned function runs on destroy
  { bar: 2 } // more initial values
);
```

### `State.is()`

Type guard - true if the argument is this class or a subclass.

```ts
Counter.is(SubCounter); // true
Counter.is(OtherState); // false
```

### `State.on()`

Registers a lifecycle handler for every instance of this class or its subclasses. Returns an unsubscribe function.

```ts
const stop = Counter.on(function (this: Counter) {
  // runs for every Counter instance on init
  return () => {
    /* cleanup on destroy */
  };
});
```

- A bare function is per-instance setup before `new()` (sugar for `{ before }`). An object hooks by cadence: `type(Class)` once per class at bootstrap, `before` per instance before `new()`, `after` per instance at the `new()` slot.
- Handlers run ancestor-first; one registered on both parent and child runs once.
- `catch(error)` receives each `Caught` mvc reports for the class ([lifecycle.md](lifecycle.md#error-handling)), `this` the instance - like nested `catch` blocks: most-derived class first, last registered first. Return the error (or a replacement `Caught`) to pass it on; return nothing to handle it; throw to escape uncaught at once - to the writer for a destroyed write. Passed off the end, a warning logs and anything else is thrown - to the writer for a destroyed write, otherwise uncaught.

```ts
State.on({
  catch(error) {
    record(error); // observe
    if (!error.warning) return error; // pass on - unhandled, it throws
  } // warnings handled
});
```

`on()` is the mix-in for environment-specific activation of a shared class. The domain module stays fields-only - no `window`, DOM, or host APIs at module scope or in `new()`; an adapter module re-exports the class and registers `on()` once, so every instance constructed after that import gets the wiring, and environments that never import the adapter never run it. Don't subclass (`class ViewSession extends Session`) and don't construct in the adapter - the consumer owns the instance. Recipe: [patterns.md](../react/patterns.md).

## Constructor Args (`State.Args`)

```ts
type Args<T> = (Args<T> | Init<T> | Assign<T> | void)[];
```

Nested arrays (flattened at runtime), objects (assigned), and callbacks (lifecycle).

## Observable / Event System

State extends Observable, also usable standalone:

```ts
import { listener, watch, event, observer, touch } from '@expressive/mvc/observable';

const stop = listener(state, (key, source) => {
  /* event */
});
const stop = watch(state, (current) => {
  /* tracked effect */
});
event(state, 'myEvent'); // manual dispatch
```

`observer(target, true)` opts a custom object into the protocol; call `touch(this, key, value)` in its getters so `watch()` and adapter hooks subscribe to accessed fields.

### Event Semantics

| Value                        | Means                      |
| ---------------------------- | -------------------------- |
| `true`                       | Ready / initial activation |
| `false`                      | Update flush completed     |
| `null`                       | Destroyed (terminal)       |
| `string \| symbol \| number` | Property or custom event   |

All events batch and flush via `queueMicrotask()`.

## Context

Every active State has a home context where its `state.get(Type)` lookups originate - `Context.root` unless a context claims it. It registers into root (findable by others) only with `static global`; a global's home locks to root at activation, while a private instance's stays claimable by the first explicit context. Largely advanced/internal - see [context.md](context.md).

Primarily consumed via the [`get` instruction](../field/get.md) and React [`Provider`](../react/react.md).

## String Representation

Each instance gets a unique identifier used by `toString()` and error messages.
