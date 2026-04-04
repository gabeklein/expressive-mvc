# State - Core Class

```ts
import State from '@expressive/state';
```

`@expressive/state` - framework-agnostic reactive state management built on classes.

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

Circular self-reference. Destructure first to retain instance access alongside values.
Also use for silent reads inside effects, or when you want to guarantee you have the unwrapped instance. `state.is` is always the instance whether or not `state` is a proxy; `state.is.is` is safe.

```ts
const { is: counter, count } = Counter.new();
counter.increment(); // write access after destructuring

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
  { foo: 1 },           // initial values
  (self) => {            // lifecycle callback
    return () => {};     // cleanup on destroy
  },
  { bar: 2 }            // more initial values
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

Register a callback for any instance creation of this class (or subclasses).

```ts
const stop = Counter.on(function (this: Counter) {
  // runs for every Counter instance on init
  return () => { /* cleanup on destroy */ };
});
```

- Callbacks run in ancestor-first order.
- Same callback registered on parent and child runs only once.
- Returns unsubscribe function.

## Constructor Args (`State.Args`)

```ts
type Args<T> = (Args<T> | Init<T> | Assign<T> | void)[];
```

Accepts nested arrays (flattened at runtime), objects (assigned), and callbacks (lifecycle).

## Observable / Event System

State extends Observable. Also usable standalone:

```ts
import { listener, watch, event } from '@expressive/state';

const stop = listener(state, (key, source) => { /* event */ });
const stop = watch(state, (current) => { /* tracked effect */ });
event(state, 'myEvent'); // manual dispatch
```

### Event Semantics

| Value                        | Means                      |
| ---------------------------- | -------------------------- |
| `true`                       | Ready / initial activation |
| `false`                      | Update flush completed     |
| `null`                       | Destroyed (terminal)       |
| `string \| symbol \| number` | Property or custom event   |

All events batched and flushed via `queueMicrotask()`.

## Context

Hierarchical state lookup - states find each other through shared context.

```ts
import { Context } from '@expressive/state';

const ctx = new Context({ AppState, UserState });
const app = ctx.get(AppState);
const child = ctx.push({ ChildState });
child.pop(); // destroy child context
```

Primarily used via `get()` instruction (see ../instructions/get.md) and React `Provider` (see ../react/react.md).

## String Representation

Each instance gets a unique identifier used by `toString()` and error messages.
