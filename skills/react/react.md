# Expressive MVC - React

`@expressive/react` connects State to React with hooks, components, and context.

For core State API (properties, reactivity, lifecycle, events) see `../state/`.
For instructions and reactive helpers (`get`, `set`, `ref`, `hot`, `def`) see `../field/*.md`.
For examples and patterns see `patterns.md`.

## Exports

```ts
// From the React adapter itself:
export { State, State as default, use, Provider, Consumer };

// Re-exported unchanged from @expressive/mvc:
export { Component, Context, def, get, ref, set, hot };
```

`Component`, `Context`, and the instructions come straight from core. The adapter does not wrap them; it populates a shared `Runtime` (see below) and patches React behavior onto the `Component` prototype as a load-time side effect. `State` is also re-exported from core, via the adapter's `./adapter` entry.

The low-level observable protocol (`observer`, `touch`, `event`, `watch`, `Observer`, etc.) is **not** re-exported here - import it from the `@expressive/mvc/observable` subpath. See [../state/observable.md](../state/observable.md).

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

## Two surfaces

This adapter exposes the library two ways. Reach for them in this order:

1. **`Component`** - a `State` that renders itself. The centerpiece: a class that owns behavior, lifecycle, context, suspense, error handling, *and* its own JSX, used directly as a React element. This is where most display-intrinsic logic should live (controls, shells, panels, editors, route controllers). See **Component Class** below and `./component.md`.
2. **Hooks on plain `State`** (`use`, `State.use`, `State.get`) - the connective tissue for headless models that have no render of their own, consumed from inside ordinary function components. Use these for display-agnostic controllers and externally-owned instances.

If a class is "a thing on screen," it is usually a `Component`. If it is "logic some component needs," it is usually a `State` reached through a hook. (`./component.md` has the full decision guide.)

---

## Component Class

`Component` extends `State` and works directly as a React element. It is the primary way to build UI with this library. See `./component.md` for the full reference (props, render composition, subcomponents, boundaries, inheritance).

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

What you get from a single class:

- State fields become optional JSX props, applied every render.
- `render()` controls output. Without it, children pass through while the instance still provides context and acts as Suspense/ErrorBoundary placement.
- The instance is provided to context automatically - descendants read it via `State.get()`.
- Built-in suspense (`fallback` prop/field) and error boundaries (`catch()` method).
- PascalCase methods become reactive subcomponents.
- Subclassing composes behavior *and* rendering: a base owns logic, a subclass fills or wraps the render. This inheritance/composition model (see `./component.md`) is the capability hooks cannot express.
- Special props: `is` (configure on creation, before `new()`), `fallback` (suspense UI).
- Strict-mode safe.

---

## Connecting plain components to State

The hooks below subscribe ordinary function components to a `State` (or any observable). Use them for headless models; for display-intrinsic logic prefer a `Component` (above).

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
- Throws for plain objects and destroyed observables.
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
  // methods bound automatically, always prefer destructure
  const { increment, count } = Counter.use();
  return <button onClick={increment}>{count}</button>;
}
```

- Instance is created once and reused across renders.
- Component re-renders when any accessed property changes.
- Instance is destroyed on unmount (context is popped, `set(null)` called).
- Safe in React strict mode (handles double-mount correctly).

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
const app = AppState.get(true); // Required<T>, suspends if any value undefined
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

| Prop       | Type                                    | Description                                                  |
| ---------- | --------------------------------------- | ----------------------------------------------------------- |
| `for`      | `State \| State.Type \| Context.Accept` | State instance, class, or map to provide                    |
| `is`       | `(instance) => void \| (() => void)`    | Configure each created instance. See note below.            |
| `fallback` | `ReactNode`                             | Wraps children in Suspense boundary                          |
| `name`     | `string`                                | Names the Suspense boundary for React DevTools               |
| `children` | `ReactNode`                             | Content rendered within provider                            |
| `[field]`  | varies                                  | State fields passed as props, merged into instance          |

`is` differs by `for`: with a single class/instance it is **required** and `(instance) => void`; with a `{ key: State }` map it is **optional** and may return a cleanup function (`(state) => void | (() => void)`), run for each instance.

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

The same core logic runs across React and Preact because host primitives are injected through a shared `Runtime` object (exported from `@expressive/react`). Each adapter's entry populates it at load:

```ts
import { Runtime } from '@expressive/react';

Object.assign(Runtime, {
  createElement, createContext, useContext,
  useState, useEffect, useRef,
  Suspense, ErrorBoundary, dedupe,
  ignore // host own-property keys to trap out of observed state
});
```

Core reads only from `Runtime`, never from `react` directly. This is the seam that keeps `packages/mvc` framework-agnostic.
