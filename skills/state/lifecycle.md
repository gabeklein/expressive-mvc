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

- Assignment throws `Caught.Destroyed` (`Tried to update {state}.{key} but state is destroyed.`) - `_` fields excepted ([state.md](state.md#unmanaged-instance-data)). The throw is an abort signal: a continuation writing after teardown stops there instead of running on against a dead state - loops like `do { this.again = false; await ... } while (this.again)` depend on it. To drop them instead, handle `Caught.Destroyed` - on `State` for the whole app (the usual port of an "ignore updates after unmount" shim), or on one class to keep the abort everywhere else: `State.on({ catch: (e) => e instanceof Caught.Destroyed ? undefined : e })`. A dropped write no longer stops a loop that polls a flag it writes.
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

What mvc does not throw it reports as a `Caught` (an `Error` exported from `@expressive/mvc`, cases as static properties) to `catch` handlers on the class chain - [State.on()](state.md#stateon). Unhandled: `console.warn` if `error.warning`, else it is thrown - to the writer for a destroyed write, otherwise uncaught (fails a test run, crashes a Node process). Every report carries `state`; `key` and `cause` where they apply. `message` names the class and ends with what was thrown (`An exception was thrown by an effect of Chat: socket closed`), so a tracker groups by it; the instance is `error.state`.

| `Caught.`   | `warning` | When                                                                   |
| ----------- | --------- | ---------------------------------------------------------------------- |
| `Destroyed` | `false`   | write to a destroyed state - thrown to the writer; a handler returning nothing drops it |
| `Inactive`  | `true`    | constructed, never activated in that tick                              |
| `Getter`    | `false`   | getter threw while refreshing - value becomes `undefined`; `cause`     |
| `Init`      | `false`   | async initializer or `new()` rejected - state still created; `cause`   |
| `Effect`    | `false`   | effect or listener threw during a flush; `cause` - collections resolve to their owner |

`error.name` is the case (`Caught.Effect`), minify-safe - console output and error trackers show it.

`catch` is class-level policy. `Component.catch()` is a separate per-instance boundary for child render errors - a Component's own effect errors reach `State.on({ catch })`, not its boundary.

Error tracker (Sentry shown - any capture call fits) - report with State context, handle the rest, let destroyed writes still abort:

```ts
State.on({
  catch(error) {
    if (error.warning) return error;
    Sentry.captureException(error, { tags: { state: String(this), key: error.key } });
    if (error instanceof Caught.Destroyed) return error; // still throws to the writer
  }
});
```

Sentry follows `cause`, so the original error and its stack arrive with the report; the rethrown `Destroyed` is not captured twice.

Log instead of escaping - a long-running process that should survive a failing effect: `State.on({ catch: Caught.log })`. It logs and handles errors; warnings and destroyed writes pass on, so both keep their default.

Tests - assert on reports, not console output. A handled report does not escape to fail the run:

```ts
const caught: Caught[] = [];
const stop = Composer.on({ catch: (error) => void caught.push(error) });

// ...trigger the failure, flush
expect(caught).toEqual([expect.any(Caught.Effect)]);
stop();
```

Other failures:

- **Reading uninitialized required values** - throws a Suspense-compatible error (Promise with Error properties) that resolves when the value is assigned, or rejects if the state is destroyed first.
- **Circular updates** - an effect updating a property it reads does not re-trigger in the same cycle; the update lands in the next batch.

## Hot Patching

Under a dev server with a class HMR plugin (`@expressive/react/vite`, `@expressive/dom/vite`), an edited class is patched onto the one already loaded - identity holds for context, imports and `instanceof`. Live instances keep their values and refresh:

- methods, getters, `render`, subcomponents and statics take the new definition; a new getter becomes computed on live instances;
- handlers the module registered with `on()` are replaced by its new ones; handlers from elsewhere stay;
- `new()`, constructor arguments and field initializers do not rerun.

A change a patch cannot carry reloads instead: a field, the constructor or `new()`, or a member switching between method and getter. A class declaring private (`#`) members reloads whenever its module re-runs - new methods cannot reach private slots of live instances; the first such reload per session logs a console warning. Subclasses and bases in other modules without their own `#` members still patch. Keep private state in `_` properties, or give a `#` class its own module.

Build integrations bind a module through `hot.accept(id, classes)` on `@expressive/mvc/runtime`, called at the end of each run: `id` is stable per module, `classes` its top-level `class X` / `let X = class` bindings. It returns the class to use for each - the one first loaded, patched, or a new one when the change is incompatible - and the module reassigns its bindings. A replaced class means the module should reload. The registry is keyed by `id`, not the bundler's hot API, so it holds wherever edited modules re-run while mvc stays loaded - the browser, and Vite's server module runner, which patches long-lived server instances the same way. `bun --hot` re-evaluates every module, mvc included, so nothing carries across it.
