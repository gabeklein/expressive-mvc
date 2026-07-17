# Expressive MVC - React

`@expressive/react` connects State to React with hooks, components, and context.

For core State API (properties, reactivity, lifecycle, events) see `../state/`.
For instructions and reactive helpers (`get`, `set`, `ref`, `hot`, `def`) see `../field/*.md`.
For examples and patterns see `patterns.md`.

## Exports

```ts
export { State, State as default }; // Reexported after augmentation with React features
export { Context, def, get, hot, ref, set }; // re-exported from @expressive/mvc
export { use }; // Hook for existing observable instances
export { Component }; // React Component class
export { Provider, Consumer }; // Explicit context components
```

## Quick Start

```tsx
import State, { Component, get, set, ref, Provider } from '@expressive/react';

class Counter extends Component {
  count = 0;
  increment() {
    this.count++;
  }

  render() {
    return <button onClick={this.increment}>{this.count}</button>;
  }
}

// Use as JSX directly
<Counter count={5} />;
```

---

## use() - Existing Observable Hook

Subscribes a React component to an existing observable object or State instance. Import with an alias when needed to avoid confusion with React's own `use`.

```tsx
import { use as useObservable } from '@expressive/react';

function CounterView({ counter }: { counter: Counter }) {
  const { count, increment } = useObservable(counter);
  return <button onClick={increment}>{count}</button>;
}
```

- Returns a tracking proxy during the initial render; property reads subscribe immediately.
- Re-renders only when accessed properties change.
- Re-subscribes if the passed observable instance is replaced.
- Activates an unready observable, but does not own lifecycle or destroy it on unmount.
- Throws for plain (non-observable) objects. A destroyed observable does not throw - the hook renders last-known values and no further updates arrive.
- Safe in React strict mode.

Use this for externally-owned observables. Use `State.use()` when the component should create and own a State instance. Use `State.get()` when the instance should come from context.

---

## State.use() - Local Component State

Creates a state instance scoped to component lifecycle. Subscribes to updates automatically. Retroactively on base State with React adapter.

```tsx
class Counter extends State {
  count = 0;
  increment() {
    this.count++;
  }
}

function App() {
  const { count, increment } = Counter.use();
  return <button onClick={increment}>{count}</button>;
}
```

- Instance is created once and reused across renders.
- Component re-renders when any accessed property changes.
- Instance is destroyed on unmount (context is popped, `set(null)` called).
- Safe in React strict mode (handles double-mount correctly).
- Open the component with a dependency snapshot: destructure the exact values it renders, nested ones included (see [Dependency Snapshots](#dependency-snapshots) below).
- Writes pass through the proxy transparently; `is` is only for retaining the root object alongside sibling destructuring (see [Transparent Writes](#transparent-writes--is) below).
- Nested observable reads are proxied and tracked automatically; do not call `use(child)` when the child was reached through the parent proxy.

React prepares fields, arguments, props, and context during render so the
initial tree and SSR output are complete. The `new()` lifecycle hook runs after
the component commits. A server-only or abandoned render never runs `new()`;
ordinary `State.new()` outside React remains synchronous.

`State.use()` cannot suspend while reading its local instance, including nested
State values. Resolve promises before calling it, or put async state in a
`Provider` and read it with `State.get()` so React can preserve the owner across
Suspense retries.

### Constructor arguments

Accepts same arguments as `State.new()` - objects, callbacks:

```tsx
const state = MyState.use({ count: 10 });
const state = MyState.use((self) => {
  /* init, runs once */
});
```

### use() method

Define `use()` on your class to intercept arguments. Called every render, so also useful for encapsulating hooks.

```tsx
class Search extends State {
  query = '';
  results: string[] = [];

  use() {
    const { search } = useLocation();
    this.query = new URLSearchParams(search).get('q') || '';
  }
}

function SearchPage() {
  const { query, results } = Search.use();
  return (
    <div>
      <h1>Results for: {query}</h1>
      {results.map((r) => {
        /* ... */
      })}
    </div>
  );
}
```

When `use()` is defined, its parameter types become the static .use() argument types. They are passed to method instead of the constructor.

```tsx
class Greeter extends State {
  greeting = '';

  use(props: { name: string }) {
    this.greeting = `Hello, ${props.name}`;
  }
}

function App({ name }: { name: string }) {
  const state = Greeter.use({ name });
  return <p>{state.greeting}</p>;
}
```

---

## State.get() - Context Hook

Fetches a state instance from context (provided by `Provider` or `Component`).
Independently subscribes to updates on accessed properties. Also on all State.

```tsx
function Profile() {
  const app = AppState.get();
  return <p>{app.user}</p>;
}
```

### Optional lookup

```tsx
const app = AppState.get(false); // undefined if not in context
```

### Required values & presence boundaries

```tsx
const app = AppState.get(true); // Required<T>, throws if an accessed value is undefined
```

`get(true)` is the child half of a **presence boundary**: the parent owns whether the child renders, and the child asserts that its required values exist. This gives the child a strong contract - no fallback values threaded through its body:

```tsx
function SettingsContent() {
  const { draft } = SettingsState.get();

  return (
    <div className="settings-layout">
      <LocationList />
      {draft && <SettingsEditor />}
    </div>
  );
}

function SettingsEditor() {
  const {
    saveSettings,
    saving,
    draft: {
      bankAccount,
      categoryAccounts,
    },
  } = SettingsState.get(true);
  ...
}
```

Declare gateable fields **optional** (`draft?: SettingsLocation`), not explicitly nullable (`draft: SettingsLocation | null`). The runtime check rejects only strict `undefined`, and TypeScript's `Required<T>` removes `?` optionality but does not strip `null` from a union - an explicitly nullable field silently defeats `get(true)` on both fronts.

### Computed selector

Pass a factory to derive a value. Reruns when deps change, and only re-renders on new result:

```tsx
const name = AppState.get(($) => $.user.name);
```

Factory receives `(current, refresh)` where:

- `current` is a tracking proxy (reads create subscriptions)
- `refresh` is a `ForceRefresh` function (see below)

Return value is the component's render value. `undefined`/`void` is converted to `null`.

### Effect (no re-render)

Return `null` to run a side effect without subscribing to updates:

```tsx
AppState.get(($) => {
  console.log($.user);
  return null;
});
```

### ForceRefresh

The second argument to `State.get()` factories triggers component refresh:

```tsx
const data = AppState.get(($, refresh) => {
  // refresh() - force re-render now
  // refresh(promise) - re-render now and again after promise settles
  // refresh(asyncFn) - re-render before and after async function
  const reload = () => refresh(fetch('/api/data'));
  return { user: $.user, reload };
});
```

### Reactive context

If the upstream instance is replaced in context (e.g., Provider re-created), the hook automatically resubscribes to the new instance and refreshes.

---

## Dependency Snapshots

Open every subscribing component by destructuring the exact reactive values it renders - nested levels included, optional objects defaulted in place:

```tsx
function ReviewNotices() {
  const {
    blocking,
    hasBlocking,
    result: {
      wssDownload: {
        selectedLocationId,
        usedLogin,
      } = {},
    },
  } = ReviewStep.get();
  ...
}
```

This is the architectural norm, not a formatting preference:

1. The component's complete dependency surface is visible at the top - reviewable at a glance.
2. Trapped getters are traversed once, instead of re-walking `review.result.wssDownload.usedLogin` in every expression.
3. Reads create subscriptions. A deep read inside a conditional branch subscribes only on renders where that branch executes (a **conditional subscription**), and reads inside event handlers never subscribe at all. Hoisting reads into the snapshot makes the dependency surface deterministic.

The same rule applies to `this` inside `Component.render()` and subcomponents - rendering shares its subscription plumbing with the hooks.

**Known gap:** updates originating in a *child State* reached through nested destructuring currently refresh `State.use()` but not `State.get()` ([#243](https://github.com/gabeklein/expressive-mvc/issues/243)). Until fixed, values a `.get()` component must react to should surface through getters on the parent state.

## Transparent Writes & `is`

Subscription proxies pass assignments through to the real instance. Three shapes cover every case:

```tsx
const form = LoginForm.get();                    // whole object is the only need
onChange={(e) => (form.username = e.target.value)}

const { transfer, confirmed } = ReviewStep.get(); // nested object from a snapshot -
onClick={() => (transfer.step = 'generate')}      // writes are transparent

const { is: review, confirmed } = ReviewStep.get(); // root object + sibling values:
                                                     // only here does `is` earn its place
```

Do not alias `is` merely because something will be written - writes never need the raw instance. Unwrapping nested objects through `is` is noise.

---

## Component Class

`Component` extends `State` and works directly as a React component. See `./component.md` for full details.

```tsx
import { Component } from '@expressive/react';

class Counter extends Component {
  count = 0;
  increment() {
    this.count++;
  }

  render() {
    return <button onClick={this.increment}>{this.count}</button>;
  }
}

<Counter count={5} />;
```

Key features:

- State fields become optional JSX props, applied every render.
- `render()` controls output; without it, children pass through a context provider.
- Instances are automatically provided to context for child access via `State.get()`.
- Built-in suspense (`fallback` property/prop) and error boundaries (`catch()` method).
- PascalCase methods become reactive subcomponents.
- Special props: `is` (creation callback), `ref` (instance ref), `fallback` (suspense UI, or `false` to defer to an ancestor boundary).
- Strict mode safe.

---

## Provider & Consumer

```tsx
import { Provider, Consumer } from '@expressive/react';

<Provider for={AppState}><App /></Provider>

// Multiple states
<Provider for={{ app: AppState, user: UserState }}><App /></Provider>

// With instance
<Provider for={existingInstance}><App /></Provider>

// With init callback
<Provider for={AppState} is={(instance) => { instance.user = "Bob"; }}>
  <App />
</Provider>

// With suspense fallback
<Provider for={AppState} fallback={<Loading />}>
  <App />
</Provider>
```

### Provider props

| Prop       | Type                                    | Description                                        |
| ---------- | --------------------------------------- | -------------------------------------------------- |
| `for`      | `State \| State.Type \| Context.Accept` | State instance, class, or map to provide           |
| `is`       | `(instance) => void`                    | Called for each created instance                   |
| `fallback` | `ReactNode`                             | Wraps children in Suspense boundary                |
| `children` | `ReactNode`                             | Content rendered within provider                   |
| `[field]`  | varies                                  | State fields passed as props, merged into instance |

State fields can be passed directly as JSX attributes:

```tsx
<Provider for={AppState} user="Bob">
  <App />
</Provider>
```

Provider creates instances from classes, or uses given instances directly.
Created instances are destroyed on unmount. Given instances are not.

### Consumer

```tsx
<Consumer for={AppState}>{(app) => <p>{app.user}</p>}</Consumer>
```

Consumer uses `State.get()` internally - child function receives a tracking proxy.

---

## Internals: Runtime

Each adapter injects framework hooks into a shared `Runtime` object, allowing the same core logic to work across React and Preact:

```ts
Object.assign(Runtime, {
  createElement,
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  Suspense,
  // plus adapter-specific: dedupe, ErrorBoundary, ignore
});
```
