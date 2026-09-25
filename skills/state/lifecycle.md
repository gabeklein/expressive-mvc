# Lifecycle - Expressive MVC

## Lifecycle Phases

| Phase        | Trigger             | What Happens                                                                  | State Ready? |
| ------------ | ------------------- | ----------------------------------------------------------------------------- | :----------: |
| Construction | `new MyState()`     | Listeners registered, nothing activated. Home context claimable.              |      NO      |
| Activation   | `State.new()`       | Properties managed, constructor args run, `new()` hook runs; a global's home locks to root | YES |
| Operation    | Property assignment | Batched updates via `queueMicrotask()`, effects re-run                        |     YES      |
| Destruction  | `state.set(null)`   | Children destroyed first, listeners called, state frozen                      |  DESTROYED   |

> Use `State.new()` for a root instance. Bare `new` constructs without activating: use it for a child State declared on another State, which adopts and activates it, or to wrap an instance in `new Context(state)` before activation ([context.md](context.md)). Either way it must activate before the end of the tick - one that does not warns; `set(null)` releases an instance you decide against.

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

- Runs once, after all properties and child states are set up.
- Return nothing, or `() => void` to run on destruction.
- `this` is the instance, not a tracking proxy - closures made here (a listener, an interval) capture it and may use it as a `Map`/`Set` key.

`new()` is a typed optional member of `State` (`protected new?(): void | (() => void)`), not name-based detection - editors autocomplete it, its signature is checked, and `override` catches a misspelling. Same for `catch()` and `mount()` on `Component`. Adapter hooks reached only through `State.use()` - `use()` and `mount()` on a plain `State` - are declared on the `UseState` interface instead, which a class satisfies structurally: optional and unadvertised on never-rendered States, at the cost of a looser check than a declared override.

> **`new()` runs on the server.** It is part of activation, so it fires wherever the state is constructed - including during `renderToString`. Its teardown never does (no unmount on the server), so a resource opened in `new()` - socket, subscription, file handle - leaks there once per render. Anything touching `window`, timers or subscriptions belongs in the adapter's commit hook: `mount()` in [../react/react.md](../react/react.md), which runs only on the client and only for a state some component owns.

> **`new()` is for consumers and own-state.** Avoid it in reusable state meant to be subclassed: it's a public method, so a subclass defining its own `new()` silently replaces yours. For internal init in a shippable base class, pass a trailing init callback to `super` - same phase as `new()`, but can't be clobbered:
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

`State.new()` accepts `State.Args`, processed in order during activation:

- `function` - called with `this` as the instance; may return a cleanup function, an object to assign, an array to process, or a Promise
- `object` - assigned to state properties
- `array` - flattened and re-processed
- `Promise` (returned by a callback) - a rejection is reported as `Caught.Init` ([Error Handling](#error-handling))

> **Timing:** args (and assigned props, in adapters) apply during activation, *after* field initializers and `State.on` setup. A trailing arg callback - like `new()` and an `on({ after })` handler - sees applied values. The JS constructor body and bare/`before` `State.on` setup run *before* the merge and see only field defaults; don't read an applied prop there.

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

`state.set(null)` triggers, in order:

1. **Children destroyed first** - owned child states, recursively
2. **Listeners notified** - destruction event dispatched
3. **Effect cleanups run** - called with `null`
4. **`new()` cleanup called**
5. **State frozen** - `Object.freeze(state)`

Children always go before parents; nested contexts destroy inner-to-outer.

Afterward:

- Assignment throws `Caught.Destroyed` (`Tried to update {state}.{key} but state is destroyed.`). The throw is an abort signal: a continuation writing after teardown stops there instead of running on against a dead state - loops like `do { this.again = false; await ... } while (this.again)` depend on it. To drop such writes instead, handle them: `State.on({ catch: (e) => e instanceof Caught.Destroyed ? undefined : e })`.
- Silent updates (`state.set(assign, true)`) drop without a report.
- Subscribing (`get(effect)`, `set(callback)`) still throws.

## Batching

All updates in one tick batch into a single flush:

```ts
state.foo = 1; // schedules queueMicrotask
state.bar = 2; // added to pending
state.baz = 3; // added to pending
// -> single flush with all 3 keys
```

Writes where the new value `===` the previous are skipped.

## Effect Lifecycle

1. Effect receives a tracking proxy of the state
2. Reads on the proxy are tracked
3. Only tracked properties trigger re-runs
4. Re-runs queue asynchronously
5. Previous cleanup runs before re-invocation

### Cleanup semantics

Cleanup functions receive a signal:

| Argument | Meaning                                |
| -------- | -------------------------------------- |
| `true`   | Effect re-running (dependency changed) |
| `false`  | Effect cancelled (manual unsubscribe)  |
| `null`   | State destroyed                        |

### Suspense in effects

An effect that throws a Promise (e.g. reading an unset `set<T>()`) pauses and retries when it resolves.

```ts
state.get((current) => {
  const value = current.pendingProp; // throws Suspense if not yet set
  console.log(value); // only runs after resolved
});
```

## Error Handling

What mvc does not throw it reports as a `Caught` (an `Error` exported from `@expressive/mvc`, cases as static properties) to `catch` handlers on the class chain - [State.on()](state.md#stateon). Unhandled: `console.warn` if `error.warning`, else it is thrown - to the writer for a destroyed write, otherwise uncaught (fails a test run, crashes a Node process). Every report carries `state`; `key` and `cause` where they apply.

| `Caught.`   | `warning` | When                                                                   |
| ----------- | --------- | ---------------------------------------------------------------------- |
| `Destroyed` | `false`   | write to a destroyed state - thrown to the writer; a handler returning nothing drops it |
| `Inactive`  | `true`    | constructed, never activated in that tick                              |
| `Getter`    | `false`   | getter threw while refreshing - value becomes `undefined`; `cause`     |
| `Init`      | `false`   | async initializer or `new()` rejected - state still created; `cause`   |
| `Effect`    | `false`   | effect or listener threw during a flush; `cause` - collections resolve to their owner |

Other failures:

- **Reading uninitialized required values** - throws a Suspense-compatible error (Promise with Error properties) that resolves when the value is assigned, or rejects if the state is destroyed first.
- **Circular updates** - an effect updating a property it reads does not re-trigger in the same cycle; the update lands in the next batch.
