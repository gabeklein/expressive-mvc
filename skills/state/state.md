# State - Core Class

```ts
import State from '@expressive/mvc';
```

`@expressive/mvc` - framework-agnostic reactive state management built on classes.

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

> `new Counter()` constructs but does NOT activate. Always prefer `Counter.new()`.

## Properties & Reactivity

Assign class fields normally. Any property write triggers a batched update event.

```ts
class App extends State {
  name = 'World';
  count = 0;
}

const app = App.new();
app.name = 'Alice'; // queues update
app.count = 1; // queues another - both flush via microtask
```

### Value Equality

Updates are skipped when new value `===` previous value. No event is emitted.

### Property Iteration

```ts
for (const [key, value] of state) {
  // iterates managed properties
}
```

## The `is` Property

Circular self-reference. Destructure first to retain instance access alongside values, and usually alias it to the state concept (`is: counter`, `is: form`) rather than keeping a local named `is`.

```tsx
const Component = () => {
  const { is: counter, count } = Counter.use();

  return <button onClick={() => counter.count++}>{count}</button>;
};
```

Also use for silent reads inside effects, or when you want to guarantee the unwrapped instance. `state.is` is always the instance whether or not `state` is a proxy. Idempotent, so `state.is.is` is safe.

```ts
// Silent read - access via `is` bypasses proxy tracking
state.get((current) => {
  console.log(current.value); // subscribes to 'value'
  console.log(current.is.other); // does NOT subscribe - silent read
});
```

## Child States

Nest states by direct assignment. Children are auto-parented, activated, and destroyed with parent.

```ts
class Parent extends State {
  child = new ChildState(); // auto-parented and activated when Parent initializes
}
```

- Replacing a child property destroys the old child (if owned).
- Non-owned children (assigned from outside) survive replacement.
- Setting a child property to `null` destroys the owned child.

## Methods

Methods are auto-bound on first access. Safe to destructure.

```ts
const { increment } = Counter.new();
increment(); // `this` is correctly bound
```

- Overwriting methods works: `test.method = () => 'bar'`.
- `super` calls work across inheritance chains.
- Methods called inside effects do NOT create subscriptions for properties they access.

## Static Methods

### `State.new()`

Creates and activates a new instance. Accepts `State.Args` - objects (initial values), callbacks (lifecycle), strings (ID).

```ts
const test = Test.new(
  { foo: 1 }, // initial values
  (self) => {
    // lifecycle callback
    return () => {}; // cleanup on destroy
  },
  { bar: 2 } // more initial values
);
```

Arguments are processed in order. Callbacks can return:

- `() => void` - cleanup function, called on destroy
- `object` - merged as initial values
- `array` - flattened and re-processed
- `Promise` - caught and logged if rejected

### `State.is()`

Type guard. Returns true if argument is this class or a subclass.

```ts
Counter.is(SubCounter); // true
Counter.is(OtherState); // false
```

### `State.on()`

Register lifecycle handlers for any instance of this class (or subclasses). Accepts either a bare function (sugar for `{ before }`) or an `On` object keyed by cadence.

```ts
// Bare function: per-instance, before new(). Sugar for { before }.
const stop = Counter.on(function (this: Counter) {
  return () => {
    /* cleanup on destroy */
  };
});

// Object form: hook by cadence.
Counter.on({
  type(Type) {
    /* per-class, once at bootstrap, before members are classified.
       Receives the class, so it may reshape the prototype. */
  },
  before(self) {
    /* per-instance, in `prepare` - before observe and new().
       May return a cleanup, constructor args, or an assign overlay. */
  },
  after(self) {
    /* per-instance, at the new() slot - after own values are observed
       and constructor args applied. May return a cleanup. */
  }
});
```

| Cadence  | When                                                  | Return                                      |
| -------- | ----------------------------------------------------- | ------------------------------------------- |
| `type`   | Once per (sub)class at bootstrap, before classify     | `void`                                      |
| `before` | Per instance, before `observe`/`new()`                | cleanup, constructor `Args`, or `Assign`    |
| `after`  | Per instance, at the `new()` slot                     | cleanup                                     |

- A handler registered on a base class runs for each subclass too.
- Callbacks run in ancestor-first order; the same handler on parent and child runs once.
- Returns an unsubscribe function.

`Component` uses the `type` cadence internally to wire its render behavior.

## Constructor Args (`State.Args`)

```ts
type Args<T> = (Args<T> | Init<T> | Assign<T> | void)[];
```

Accepts nested arrays (flattened at runtime), objects (assigned), and callbacks (lifecycle).

## Observable / Event System

State extends Observable. Also usable standalone:

```ts
import { listener, watch, event, observer, touch } from '@expressive/mvc';

const stop = listener(state, (key, source) => {
  /* event */
});
const stop = watch(state, (current) => {
  /* tracked effect */
});
event(state, 'myEvent'); // manual dispatch
```

Use `observer(target, true)` to opt a custom object into the observable protocol, then use `touch(this, key, value)` in getters so `watch()` and adapter hooks can subscribe to accessed fields.

### Event Semantics

| Value                        | Means                      |
| ---------------------------- | -------------------------- |
| `true`                       | Ready / initial activation |
| `false`                      | Update flush completed     |
| `null`                       | Destroyed (terminal)       |
| `string \| symbol \| number` | Property or custom event   |

All events batched and flushed via `queueMicrotask()`.

## Context

Every active State has a "home context" that determines where its `state.get(Type)` lookups originate. `State.new()` registers to `Context.root` (the global singleton) when not already claimed; `new Context(StateClass)` registers to particular context. Home is locked once assigned. Largely advanced/internal.

See [context.md](context.md) for the full Context API, root singleton semantics, and the `new State()` escape hatch for pre-init context placement.

Primarily consumed via the [`get` instruction](../field/get.md) and React [`Provider`](../react/react.md).

## String Representation

Each instance gets a unique identifier used by `toString()` and error messages.
