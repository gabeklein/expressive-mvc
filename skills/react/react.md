# Expressive MVC - React

`@expressive/react` is the React host: a `Component` renders as a React component, `<Component for>` provides a Model to the tree, and function components read it with `Model.get()`.

- Core Model API (properties, reactivity, lifecycle, events): `../state/`.
- Instructions and reactive helpers (`get`, `set`, `ref`, `map`, `has`, `def`): `../field/*.md`.
- Examples and patterns: `patterns.md`.

## Exports

`@expressive/react` exports nothing for app code - import it once, for its side effect, and take `Model`, `Component` and the instructions from `@expressive/mvc`. Subpaths: `@expressive/react/adapter` (`Runtime`, for writing a host) and `@expressive/react/vite` (the hot-reload plugin).

## Quick Start

```tsx
import { Model, Component, get, set, ref } from '@expressive/mvc';
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

## mount() method

Client-only effects. Called once when the host component commits; the returned function runs on unmount.

```tsx
class Viewport extends Model {
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
| `<Component />`               | yes     | yes       |
| `<Component for={Model}>`     | yes     | yes       |
| `<Component for={instance}>`  | no      | no        |
| `Model.get()`                 | no      | no        |
| `{instance}`                  | no      | no        |
| `Model.new()`                 | no host | no        |

`<Component for={Model}>` runs the provided instance's `mount()` with its own commit:

- Like any parent, it mounts *after* its descendants (React commits bottom-up) - a descendant should react to a provided instance by subscription, not read it imperatively in its own `mount()`.
- Replacing `for` with another class unmounts and destroys the previous instance, then mounts the new one.

The excluded paths are *many-to-one*: any number of components can `.get()` one instance or place it as `{instance}`, each for less time than the instance lives. A hook firing once per observer is not a lifecycle - to react to an instance a component does not own, subscribe with `Model.get()` or an event.

`mount()` never runs during server render.

Pick the seam by what the work needs:

| Hook       | Phase        | Runs                        | On the server |
| ---------- | ------------ | --------------------------- | ------------- |
| `new()`    | construction | once, synchronously         | yes           |
| `mount()`  | commit       | once, when the host commits | no            |

Setup accompanying the instance itself goes in `new()`; anything touching `window`, timers or subscriptions goes in `mount()`.

React can discard a render before committing it - a suspended first mount, a dropped transition. Instances an owning path created there are already activated, so `new()` ran; the adapter destroys them once React releases the attempt, at garbage collection rather than promptly. `mount()` runs only for the attempt that commits - another reason effects belong there.

## Server render (SSR / RSC)

Expressive components render on the server - `renderToString`, and the SSR pass of an RSC app (they are client components) - without touching the DOM. Effects don't run, so `mount()` never fires; `new()` does. Request-safety rules:

- **Request state goes in a `<Component for>`.** Each render builds its own context, so provided instances are isolated per request.
- **A `static global` is process-wide, *shared across requests* on the server** (globals are not sealed - a `global` is trusted to be mutable process state like config, flags or a warmed cache). Keep per-request data out; provide it with `<Component for>`.
- **Resources belong in `mount()` or the request handler, never `new()`.** `new()` runs on the server but its returned teardown does not (no unmount), so a socket or handle opened there leaks. `mount()` is client-only; server-side resources are the framework's request scope to open and close.

To render a specific request's data (a path, a session), provide it per request: `<Component for={Session} …>`. For this reason `Router` is a client-only global - on the server it is per-render, so paths never bleed between requests; provide `<Component for={Router} path={…}>` to render a request's path.

## React Native

Works with no configuration - the adapter imports only `react` and `react/jsx-runtime`, and Metro resolves it as published. Three boundaries:

- **Jest.** The build is ESM-only and `jest-expo` skips `node_modules`, so the import fails to parse until `@expressive` is added to `transformIgnorePatterns`:

  ```js
  transformIgnorePatterns: [
    '/node_modules/(?!(.pnpm|@expressive|react-native|@react-native|expo|@expo))'
  ]
  ```

- **`BrowserRouter` is the browser binding** - it reads `window.location`, undefined in React Native. Use `Router`, whose path and history are in memory.
- **`Link` and `NavLinks` render DOM elements** (`<a>`, `<ul>`) with no native host yet. Drive navigation from `Router` directly and render your own `Pressable`.

## Hot reload (Vite)

```ts
// vite.config.ts
import react from '@vitejs/plugin-react';
import expressive from '@expressive/react/vite';

export default defineConfig({ plugins: [react(), expressive()] });
```

Editing a `Model` or `Component` class patches it in place - instances keep their values and re-render with the new methods, getters, `render` and subcomponents. React Refresh keeps function components. A field, constructor or `new()` change reloads the page, as does any edit to a module declaring a class with `#` private members ([../state/lifecycle.md](../state/lifecycle.md#hot-patching)). Dev server only.

A class must be top-level `class X` or `let X = class` - a `const` binding cannot be patched. `export default X;` exports a snapshot, so its importers are not checked for staleness - prefer `export default class X` or `export { X as default }`; likewise an anonymous `export default`.

---

## Model.get() - Context Hook

Fetches an instance from context (provided by a `Component` or `<Component for>`) and independently subscribes to accessed properties. Available on every Model.

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

### Presence boundaries

Destructure a field that may be unset and render conditionally - the narrowed value passes on as a prop:

```tsx
const { draft } = Settings.get();
if (draft) return <Editor draft={draft} />;
return <Spinner />;
```

The parent owns whether the child renders; the child's prop type asserts the value exists - no fallback values threaded through its body:

```tsx
function SettingsContent() {
  const { draft } = SettingsState.get();

  return (
    <div className="settings-layout">
      <LocationList />
      {draft && <SettingsEditor draft={draft} />}
    </div>
  );
}

function SettingsEditor({ draft }: { draft: SettingsLocation }) {
  const {
    saveSettings,
    saving,
  } = SettingsState.get();

  const {
    bankAccount,
    categoryAccounts,
  } = draft;
  ...
}
```

### Derived values and effects

Derive from the snapshot in render, or declare a getter on the Model ([../state/computed.md](../state/computed.md)); side effects belong in `mount()` or an instance effect (`state.get(effect)`).

```tsx
function Greeting() {
  const { user: { name } } = AppState.get();
  return <p>Hello, {name.toUpperCase()}</p>;
}
```

### Custom lookup

A class overriding static `get` keeps context and render tracking - `User.get(id)` subscribes like `User.get()`. See [../state/get.md](../state/get.md#static-get).

Bare `Context.get()` returns the render's context in a render, else root - safe anywhere. `state.get(Type)` runs no hooks and does not subscribe the component.

### Reactive context

If the upstream instance is replaced in context (e.g. `<Component for>` given a new item), the hook resubscribes to the new instance and refreshes. An instance arriving after mount refreshes it too - `get(false)` included. Once the instance leaves, `get(false)` returns `undefined` and a required `get()` throws - unmount consumers before destroying their provider.

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

`Component` extends `Model` and works directly as a React component - full details in `./component.md`.

- Model fields become optional JSX props, applied every render.
- `render()` controls output; without it, children pass through a context provider.
- Instances are provided to context for child access via `Model.get()`.
- Built-in suspense (`fallback` property/prop) and error boundaries (`catch()` method).
- PascalCase methods become reactive subcomponents.
- Special props: `is` (creation callback), `ref` (instance ref), `fallback` (suspense UI, or `false` to defer to an ancestor boundary).
- Strict-mode safe.

---

## Providing state

`<Component for={AppState}>` provides one instance to its children, with no boundary unless `fallback` or `catch` is passed - contract in [context.md](../state/context.md#providing-with-component); `mount()` timing in [mount() method](#mount-method). For a render-prop read, write an FC calling `AppState.get()`.

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
  startTransition,      // optional: for pending() work
  Suspense,
  idle,                 // true when certainly not rendering, undefined when it cannot tell
  // plus adapter-specific: dedupe, ErrorBoundary, ignore
});
```

`idle()` lets `Context.get()` skip its hook probe outside a render - React reads its dispatcher (`null`, or the between-render stub whose hooks all throw); Preact returns `undefined` and probes, which never logs. An unrecognised React returns `undefined` too.
