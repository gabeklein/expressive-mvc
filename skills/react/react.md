# Expressive MVC - React

`@expressive/react` connects State to React with hooks, components, and context.

- Core State API (properties, reactivity, lifecycle, events): `../state/`.
- Instructions and reactive helpers (`get`, `set`, `ref`, `map`, `has`, `def`): `../field/*.md`.
- Examples and patterns: `patterns.md`.

## Exports

```ts
export { State, State as default }; // deprecated - import { State } from @expressive/mvc
export { Context, def, get, ref, set, pending }; // deprecated re-exports of @expressive/mvc
export { has, map }; // deprecated - import from @expressive/mvc
export { Component }; // deprecated re-export of @expressive/mvc
```

## Quick Start

```tsx
import { State, Component, get, set, ref } from '@expressive/mvc';
import '@expressive/react'; // once, in the entry module

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

---

## State.use() - Local Component State

Creates an instance scoped to the component's lifecycle and subscribes to it. Added to base State by the React adapter.

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
- Re-renders when any accessed property changes; nested observable reads are proxied and tracked.
- Destroyed on unmount (context popped, `set(null)` called).
- Not kept by a render React discards: if the component suspends before its first commit - reading the instance's own pending value included - React drops it, and each retry creates and loads a new one, so the render never resolves. Own loading state in an ancestor that has committed and let the reader suspend ([Suspense](component.md#suspense)).
- Strict-mode safe.
- Open the component with a dependency snapshot: destructure the exact values it renders, nested ones included ([Dependency Snapshots](#dependency-snapshots)).
- Writes pass through the proxy; `is` is only for retaining the root object alongside sibling destructuring ([Transparent Writes](#transparent-writes--is)).

### Constructor arguments

Same arguments as `State.new()` - objects, callbacks:

```tsx
const state = MyState.use({ count: 10 });
const state = MyState.use((self) => {
  /* init, runs once */
});
```

### use() method

Define `use()` on the class to intercept arguments. Called every render, so it can also encapsulate hooks.

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

This bridges router hooks (`useParams`, `useLocation`, `useNavigate`); the alternative - an outer FC passing params as props - and route-identity guidance are in [patterns.md](patterns.md).

When `use()` is defined, its parameter types become the static `.use()` argument types, and arguments go to the method instead of the constructor:

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

### mount() method

Client-only effects. Called once when the host component commits; the returned function runs on unmount.

```tsx
class Viewport extends State {
  width = 0;

  mount() {
    const measure = () => (this.width = window.innerWidth);

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }
}
```

`mount()` is an **ownership** hook, not an observation one - it runs where a component creates and destroys the instance, never on a path merely reaching an instance owned elsewhere:

| Reaching an instance          | Owns it | `mount()` |
| ----------------------------- | ------- | --------- |
| `State.use()`                 | yes     | yes       |
| `<Component />`               | yes     | yes       |
| `<Component for={State}>`     | yes     | yes       |
| `<Component for={instance}>`  | no      | no        |
| `State.get()`                 | no      | no        |
| `{instance}`                  | no      | no        |
| `State.new()`                 | no host | no        |

`<Component for={State}>` runs the provided State's `mount()` with its own commit:

- Like any parent, it mounts *after* its descendants (React commits bottom-up) - a descendant should react to provided state by subscription, not read it imperatively in its own `mount()`.
- Replacing `for` with another class unmounts and destroys the previous State, then mounts the new one.

The excluded paths are *many-to-one*: any number of components can `.get()` one instance or place it as `{instance}`, each for less time than the instance lives. A hook firing once per observer is not a lifecycle - to react to an instance a component does not own, subscribe with `State.get()` or an event.

`mount()` never runs during server render.

Pick the seam by what the work needs:

| Hook       | Phase        | Runs                        | On the server |
| ---------- | ------------ | --------------------------- | ------------- |
| `new()`    | construction | once, synchronously         | yes           |
| `use()`    | render       | every render of the host    | yes           |
| `mount()`  | commit       | once, when the host commits | no            |

Setup accompanying the instance itself goes in `new()`; anything touching `window`, timers or subscriptions goes in `mount()`.

### Server render (SSR / RSC)

Expressive components render on the server - `renderToString`, and the SSR pass of an RSC app (they are client components) - without touching the DOM. Effects don't run, so `mount()` never fires; `new()` and `use()` do. Request-safety rules:

- **Request state goes in a `<Component for>`.** Each render builds its own context, so provided instances are isolated per request.
- **A `static global` is process-wide, *shared across requests* on the server** (globals are not sealed - a `global` is trusted to be mutable process state like config, flags or a warmed cache). Keep per-request data out; provide it with `<Component for>`.
- **Resources belong in `mount()` or the request handler, never `new()`.** `new()` runs on the server but its returned teardown does not (no unmount), so a socket or handle opened there leaks. `mount()` is client-only; server-side resources are the framework's request scope to open and close.

To render a specific request's data (a path, a session), provide it per request: `<Component for={Session} …>`. For this reason `Router` is a client-only global - on the server it is per-render, so paths never bleed between requests; provide `<Component for={Router} path={…}>` to render a request's path.

### React Native

Works with no configuration - the adapter imports only `react` and `react/jsx-runtime`, and Metro resolves it as published. Three boundaries:

- **Jest.** The build is ESM-only and `jest-expo` skips `node_modules`, so the import fails to parse until `@expressive` is added to `transformIgnorePatterns`:

  ```js
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|@expressive|react-native|@react-native|expo|@expo))'
  ]
  ```

- **`BrowserRouter` is the browser binding** - it reads `window.location`, undefined in React Native. Use `Router`, whose path and history are in memory.
- **`Link` and `NavLinks` render DOM elements** (`<a>`, `<ul>`) with no native host yet. Drive navigation from `Router` directly and render your own `Pressable`.

### Hot reload (Vite)

```ts
// vite.config.ts
import react from '@vitejs/plugin-react';
import expressive from '@expressive/react/vite';

export default defineConfig({ plugins: [react(), expressive()] });
```

Editing a `State` or `Component` class patches it in place - instances keep their values and re-render with the new methods, getters, `render` and subcomponents. React Refresh keeps function components. A field, constructor or `new()` change reloads the page, as does any edit to a module declaring a class with `#` private members ([../state/lifecycle.md](../state/lifecycle.md#hot-patching)). Dev server only.

A class must be top-level `class X` or `let X = class` - a `const` binding cannot be patched. `export default X;` exports a snapshot, so its importers are not checked for staleness - prefer `export default class X` or `export { X as default }`; likewise an anonymous `export default`.

---

## State.get() - Context Hook

Fetches an instance from context (provided by a `Component` or `<Component for>`) and independently subscribes to accessed properties. Available on all State.

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

`get(true)` is the child half of a **presence boundary**: the parent owns whether the child renders; the child asserts its required values exist - no fallback values threaded through its body:

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

Declare gateable fields **optional** (`draft?: SettingsLocation`), not nullable (`draft: SettingsLocation | null`). The runtime check rejects only strict `undefined`, and `Required<T>` removes `?` but does not strip `null` from a union - a nullable field silently defeats `get(true)` on both fronts.

### Computed selector

Pass a factory to derive a value. Reruns when deps change; re-renders only on a new result:

```tsx
const name = AppState.get(($) => $.user.name);
```

Factory receives `(current, refresh)`:

- `current` - tracking proxy (reads create subscriptions)
- `refresh` - `ForceRefresh` function (below)

The return value is the hook's result; `undefined`/`void` becomes `null`.

### Effect (no re-render)

Return `null` to run a side effect without subscribing:

```tsx
AppState.get(($) => {
  console.log($.user);
  return null;
});
```

### ForceRefresh

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

If the upstream instance is replaced in context (e.g. `<Component for>` given a new item), the hook resubscribes to the new instance and refreshes.

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

An architectural norm, not formatting:

1. The complete dependency surface is visible at the top.
2. Trapped getters are traversed once, not re-walked (`review.result.wssDownload.usedLogin`) in every expression.
3. Reads create subscriptions. A deep read inside a conditional branch subscribes only on renders where that branch runs (a **conditional subscription**), and reads inside event handlers never subscribe. Hoisting reads into the snapshot makes the dependency surface deterministic.

The same applies to `this` inside `Component.render()` and subcomponents - rendering shares the hooks' subscription plumbing.

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

`Component` extends `State` and works directly as a React component - full details in `./component.md`.

- State fields become optional JSX props, applied every render.
- `render()` controls output; without it, children pass through a context provider.
- Instances are provided to context for child access via `State.get()`.
- Built-in suspense (`fallback` property/prop) and error boundaries (`catch()` method).
- PascalCase methods become reactive subcomponents.
- Special props: `is` (creation callback), `ref` (instance ref), `fallback` (suspense UI, or `false` to defer to an ancestor boundary).
- Strict-mode safe.

---

## Providing state

`<Component for={AppState}>` provides one State to its children, with no boundary unless `fallback` or `catch` is passed - contract in [context.md](../state/context.md#providing-with-component); `mount()` timing in [mount() method](#mount-method). For a render-prop read, write an FC calling `AppState.get()`.

`Provider` was removed - replace `<Provider for={X}>` with `<Component for={X}>`.

---

## Internals: Runtime

Each adapter injects framework hooks into a shared `Runtime` object, so the same core logic works across React and Preact:

```ts
Object.assign(Runtime, {
  createElement,
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useSyncExternalStore, // optional: pre-commit revision validation
  transition,           // optional: startTransition, for pending() work
  Suspense,
  // plus adapter-specific: dedupe, ErrorBoundary, ignore
});
```
