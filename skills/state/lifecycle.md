# Lifecycle - Expressive MVC

## Lifecycle Phases

| Phase        | Trigger             | What Happens                                                                            | State Ready? |
| ------------ | ------------------- | --------------------------------------------------------------------------------------- | :----------: |
| Construction | `new MyState()`     | Listeners registered, nothing activated. Home context still claimable.                  |      NO      |
| Activation   | `State.new()`       | Properties managed, constructor args run, `new()` hook runs, home context locked        |     YES      |
| Operation    | Property assignment | Batched updates via `queueMicrotask()`, effects re-run                                  |     YES      |
| Destruction  | `state.set(null)`   | Children destroyed first, listeners called, state frozen                                |  DESTROYED   |

> **Always use `State.new()` not `new State()`** unless you need to defer activation. `new State()` constructs without firing the ready event - useful as an escape hatch when you want to wrap an instance in a `new Context(state)` *before* it activates (otherwise activation locks the home to `Context.root`). See [context.md](context.md).

## The `new()` Hook

```ts
class Timer extends State {
  elapsed = 0;

  protected new() {
    const id = setInterval(() => this.elapsed++, 1000);
    return () => clearInterval(id);
  }
}
```

- Runs once after all properties are initialized and child states are set up.
- Return `void` if no cleanup needed.
- Return `() => void` for a cleanup function called on destruction.

> **`new()` is for consumers and own-state.** Avoid it in reusable state meant to be subclassed: it's a public method, so an extending class that defines its own `new()` silently overrides yours and loses the base behavior (with no error). For internal init logic in a shippable base class, pass a trailing init callback to `super` instead - it runs in the same phase as `new()` but can't be clobbered:
>
> ```ts
> class Route extends Component {
>   index = false;
>   to = '*';
>
>   constructor(props: {}, ...rest: State.Args) {
>     // runs after props are applied, like new(), but not overridable
>     super(props, ...rest, () => {
>       if (this.index) this.to = '';
>     });
>   }
> }
> ```

## Constructor Arguments

`State.new()` accepts `State.Args` - processed in order during activation:

- `function` - called with `this` context; return value becomes cleanup, or object/array to apply
- `object` - assigned to state properties
- `Promise` - caught and logged if rejected
- `array` - flattened and re-processed

> **Timing:** args (and assigned props, in adapters) are applied during activation, *after* field initializers and registered setup (`State.on`). So a trailing arg callback - like `new()` - observes applied prop/arg values. The JS constructor body and `State.on` setup run *before* this merge and see only field defaults; don't read an applied prop there.

```ts
const test = Test.new(
  { foo: 1 },
  (self) => {
    return () => console.log('destroyed');
  },
  { bar: 2 }
);
```

## Destruction

`state.set(null)` triggers:

1. **Children destroyed first** - owned child states are destroyed recursively
2. **All listeners notified** - destruction event dispatched
3. **Effect cleanups run** - cleanup functions called with `null`
4. **`new()` cleanup called** - returned function from `new()` invoked
5. **State frozen** - `Object.freeze(state)` prevents further updates

Children are always destroyed before parents. In nested contexts, destruction happens inner-to-outer.

Post-destruction:

- Property assignment throws: `"Tried to update {state}.{key} but state is destroyed."`
- Silent updates (`state.set(assign, true)`) return without throwing.

## Batching

All property updates in the same tick are batched into a single flush:

```ts
state.foo = 1; // schedules queueMicrotask
state.bar = 2; // added to pending
state.baz = 3; // added to pending
// -> single flush with all 3 keys
```

Updates are skipped when new value `===` previous value.

## Effect Lifecycle

1. Effect callback receives a tracking proxy of the state
2. Property accesses on proxy are tracked
3. Only tracked properties trigger re-runs
4. Re-runs are queued asynchronously
5. Previous cleanup runs before re-invocation

### Cleanup semantics

Effect cleanup functions receive a signal argument:

| Argument | Meaning                                |
| -------- | -------------------------------------- |
| `true`   | Effect re-running (dependency changed) |
| `false`  | Effect cancelled (manual unsubscribe)  |
| `null`   | State destroyed                        |

### Suspense in effects

If an effect throws a Promise (e.g., accessing an unset `set<T>()` property), the effect pauses and retries when the Promise resolves.

```ts
state.get((current) => {
  const value = current.pendingProp; // throws Suspense if not yet set
  console.log(value); // only runs after resolved
});
```

## Error Handling

### Async errors in constructors

Caught and logged to `console.error`. Do not prevent state creation.

### Accessing destroyed state

Throws synchronously. Silent mode (`state.set(assign, true)`) skips instead of throwing.

### Accessing uninitialized required values

Throws a Suspense-compatible error (Promise with Error properties). Resolves when the value is assigned. Rejects if state is destroyed first.

### Circular updates

Effects that update properties they read don't re-trigger in the same cycle. The update is processed in the next batch.
