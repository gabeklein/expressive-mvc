# Expressive State - React

`@expressive/react` connects State to React with hooks, components, and context.

For core State API (properties, reactivity, lifecycle, events) see `../state/`.
For instructions (`get`, `set`, `ref`, `def`) see `../instructions/*.md`.
For examples and patterns see `patterns.md`.

## Exports

```ts
export { State, State as default }; // Reexported after agumentation with React features
export { use }; // Observe a State/Observable instance by reference
export { Context, Observable, def, get, ref, set }; // re-exported from @expressive/state
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

## use() - Observe By Reference

Subscribes to an existing `State` or `Observable` object. Use this when a component
receives state by prop instead of reading it from context.

```tsx
import { use } from '@expressive/react';

function CounterButton({ counter }: { counter: Counter }) {
  const { count, increment } = use(counter);
  return <button onClick={increment}>{count}</button>;
}
```

- Returns a tracking proxy. Values accessed during render trigger refresh when changed.
- Does not create, destroy, or provide the instance.
- Does not fall back to React's built-in `use()`.

### Optional reference

```tsx
const counter = use(props.counter);
return counter ? <span>{counter.count}</span> : null;
```

`null` and `undefined` inputs return `undefined`.

### Required values

```tsx
const counter = use(props.counter, true); // Required<Counter>
```

### Computed selector

```tsx
const count = use(counter, ($) => $.count);
```

The selector behaves like `State.get(selector)`: it tracks accessed values and
only refreshes the component when the selected result changes.

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
- Special props: `is` (creation callback), `fallback` (suspense UI).
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

## Internals: Pragma

React adapter injects framework hooks via a `Pragma` object, allowing the same core logic to work across React and Preact:

```ts
Pragma.useEffect = React.useEffect;
Pragma.useState = React.useState;
Pragma.createElement = React.createElement;
Pragma.useRef = React.useRef;
```
