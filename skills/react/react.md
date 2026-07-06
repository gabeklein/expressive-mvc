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
- Always prefer destructuring `State.use()` / `State.get()`.
- When the raw instance is needed, destructure `is` and alias it to the state concept (`is: counter`, `is: form`).
- Nested observable reads are proxied and tracked automatically. Nested destructuring subscribes to child State fields; do not call `use(child)` when the child was reached through the parent proxy.

```tsx
const {
  comment: {
    value: comment,
  },
} = Counter.use();
```

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

### Required values

```tsx
const app = AppState.get(true); // Required<T>, throws if an accessed value is undefined
```

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
