---
name: expressive-mvc
description: Class-based reactive state management for React. Covers State API, instructions, Component class, lifecycle, patterns, and codebase auditing.
---

# Expressive MVC

Class-based reactive state for React, Preact, and Solid. State classes define reactive properties, computed values, async data, and context - all as plain class fields using instruction helpers.

## Packages

| Package              | Status    | Description                                                       |
| -------------------- | --------- | ----------------------------------------------------------------- |
| `@expressive/react`  | Published | React adapter. Primary import for State, Component, instructions. |
| `@expressive/mvc`  | Published | Framework-agnostic core. Rarely imported directly.                |
| `@expressive/preact` | Private   | Thin wrapper over React adapter via preact/hooks. Prerelease.     |
| `@expressive/solid`  | Private   | Standalone implementation. Experimental.                          |

## Core API

```tsx
import State, {
  Component,
  use,
  ref,
  def,
  get,
  hot,
  set,
  Provider
} from '@expressive/react';
```

### State Class

Extend `State` to define reactive models. Always instantiate via `State.new()`, not `new`.

```tsx
class Counter extends State {
  count = 0;

  increment() {
    this.count++;
  }
}

const counter = Counter.new();
counter.count; // 0
counter.increment();
counter.count; // 1
```

Properties assigned in the class body are reactive - updates notify subscribers. Methods are auto-bound.

### Instructions & Helpers

Field initializers and helper values that configure reactive behavior. Each has multiple overloads - see linked docs for full details.

#### `def()` - Custom Property

| Form           | Behavior                                                                                                    |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| `def(factory)` | Primitive instruction. Factory receives `(key, subject, state)`. Return config object, cleanup fn, or void. |

#### `set()` - Values, Factories & Validation

| Form                  | Behavior                                                       |
| --------------------- | -------------------------------------------------------------- |
| `set<T>()`            | Placeholder. Suspends on access until assigned.                |
| `set(value)`          | Default value. Non-enumerable, writable.                       |
| `set(() => v)`        | Lazy factory. Read-only. If async, suspends.                   |
| `set(() => v, false)` | Lazy factory. Returns `undefined` while pending (no suspense). |
| `set(() => v, true)`  | Eager factory. Runs immediately on init.                       |
| `set(value, cb)`      | Default with setter callback. `throw false` to reject.         |
| `set(() => v, cb)`    | Factory with setter callback. Makes writable.                  |

For **reactive computed values**, declare a normal class getter (e.g. `get total() { ... }`). Getters on a State subclass are auto-promoted to memoized, dependency-tracked properties.

Do not pass a direct promise to `set()`. Use `set(() => promise)` or `set(async () => value)` so work starts during activation/access instead of construction, which avoids leaked work from abandoned instances.

#### `get()` - Context Lookup

| Form                     | Behavior                                         |
| ------------------------ | ------------------------------------------------ |
| `get(Type)`              | Required upstream lookup. Throws if missing.     |
| `get(Type, false)`       | Optional upstream. Returns `T \| undefined`.     |
| `get(Type, cb)`          | Upstream with callback. Return cleanup function. |
| `get(Type, true)`        | Downstream collection. Returns `readonly T[]`.   |
| `get(Type, true, cb)`    | Downstream collection with per-child callback.   |
| `get(Type, true, true)`  | Single downstream child. Required.               |
| `get(Type, true, false)` | Single downstream child. Optional.               |

#### `ref()` - Mutable References

| Form                | Behavior                                                |
| ------------------- | ------------------------------------------------------- |
| `ref<T>()`          | Mutable ref with `.current`. Like `useRef`.             |
| `ref<T>(cb)`        | Ref with callback on set. Return cleanup.               |
| `ref<T>(cb, false)` | Ref callback also fires for `null`.                     |
| `ref(this)`         | Ref proxy - creates refs for all enumerable properties. |
| `ref(this, mapFn)`  | Custom ref proxy with transform per key.                |

#### `hot()` - Reactive Arrays & Objects

| Form          | Behavior                                                             |
| ------------- | -------------------------------------------------------------------- |
| `hot(array)`  | Wraps a dense array so index, length, and method reads are reactive. |
| `hot(object)` | Wraps an object so property reads are reactive.                      |

`hot()` is a reactive helper, not a field instruction. Maybe be used without attaching a state, or in conjunction with instructions (such as set). Use it when an object or array needs keyed reactivity without extracting a dedicated `State` class.

### React Hooks

```tsx
// Existing observable - subscribes to accessed fields, does not own lifecycle
function Existing({ counter }: { counter: Counter }) {
  const { count, increment } = use(counter);
  return <button onClick={increment}>{count}</button>;
}

// Local state - creates instance, subscribes to accessed fields
function MyComponent() {
  const { count, increment } = Counter.use();
  return <button onClick={increment}>{count}</button>;
}

// Context state - reads nearest Provider, subscribes reactively
function Child() {
  const { count } = Counter.get();
  return <span>{count}</span>;
}
```

Use `use(subject)` for externally-owned observables or State instances. It returns a tracking proxy on the initial render, re-subscribes when `subject` is replaced, activates an unready observable, and does not destroy the subject on unmount.

### Component Class

A `Component` is a `State` that renders itself. It provides context automatically and supports suspense/error boundaries.

```tsx
class CounterView extends Component {
  count = 0;

  increment() {
    this.count++;
  }

  render() {
    const { count, increment } = this;
    return <button onClick={increment}>{count}</button>;
  }
}

// Use directly in JSX
<CounterView />;
```

### Provider & Context

```tsx
// Provide state to descendants
<Provider of={Counter}>
  <Child />
</Provider>;

// Or with explicit instance
const counter = Counter.use();
<Provider of={counter}>
  <Child />
</Provider>;
```

### Common Patterns

```tsx
// Async data with Suspense
class UserProfile extends State {
  userId = set<string>();
  user = set(async () => {
    const res = await fetch(`/api/users/${this.userId}`);
    return res.json();
  });
}

// Computed values (reactive - auto-tracks dependencies)
class Cart extends State {
  items = set<Item[]>([]);
  get total() {
    return this.items.reduce((sum, i) => sum + i.price, 0);
  }
}

// Setter callback (validation)
class Form extends State {
  email = set('', (value) => {
    if (!value.includes('@')) throw false; // reject update
  });
}
```

### Choosing State vs Component

Before extracting state, decide who owns the behavior:

- Use `Component` when state is intrinsic to display logic: controls, shells, panels, editors, canvases, toasts. Usually that means defining `render()`.
- A `Component` without `render()` passes children through while still providing itself to context and acting as Suspense/ErrorBoundary placement. Use that only when React tree placement matters: route controllers, progressive `Boundary` wrappers, or repeated contextual owners.
- Use `State` for headless models/controllers, even if they are only useful in context. A provided State or Component implicitly provides its child States, so prefer `public theme = new Theme()` over stacking Providers for every small controller.
- Avoid `Component` when a provided `State` would suffice; Components carry React instance surface (`props`, `state`, `context`, `setState`, `forceUpdate`) that can make `.get()` IntelliSense noisier.
- Keep plain function components for simple presentation or trivial local UI state.

Do not create a separate `FooState` plus `FooView` just because hooks were present. If the behavior and rendering are one unit, `class Foo extends Component` is the better refactor.

### Refactoring React Hooks

Do not translate hooks one-for-one. First identify the owner, then model it as either a `Component` or a display-agnostic `State`:

- Values directly written by user input, browser events, timers, or network callbacks become mutable class fields.
- Values derived from those fields become class getters, not extra fields kept in sync by effects.
- `useEffect` setup/teardown becomes `protected new()` with a returned cleanup function.
- `useCallback` handlers become auto-bound class methods.
- If the state is only meaningful for that component's own UI, put those fields and methods directly on a `Component` subclass.
- If the state is a headless model, keep it in a `State` subclass and have React components call `State.use()` / `State.get()` or attach it to component's controller.
- If tree placement, rendering, boundaries, or subcomponents are the point, make it a `Component`.

```tsx
class Viewport extends State {
  width = window.innerWidth;

  get compact() {
    return this.width < 720;
  }

  protected new() {
    const update = () => {
      this.width = window.innerWidth;
    };

    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }
}

function LayoutBadge() {
  const { width, compact } = Viewport.use();

  return <span>{compact ? 'Compact' : `Wide (${width}px)`}</span>;
}
```

## File Reference

Fetch these for detailed API documentation when the task requires deeper knowledge.

### State (core)

- [state/state.md](state/state.md) - State class, instantiation, properties, methods, events, context
- [state/get.md](state/get.md) - Instance `.get()` method: read values, run effects, context lookup
- [state/set.md](state/set.md) - Instance `.set()` method: write values, listen to updates, events, destroy
- [state/computed.md](state/computed.md) - Reactive class getters: tracking, caching, inheritance, suspense
- [state/lifecycle.md](state/lifecycle.md) - Construction, activation, operation, destruction phases
- [state/context.md](state/context.md) - Context system, root singleton, home context, ownership rules
- [state/types.md](state/types.md) - TypeScript type aliases and utility types

### Instructions & Reactive Helpers

- [field/set.md](field/set.md) - Property descriptors, defaults, factories, setter callbacks
- [field/get.md](field/get.md) - Context lookup: upstream, downstream, callbacks
- [field/ref.md](field/ref.md) - Mutable refs, ref proxy, callbacks
- [field/hot.md](field/hot.md) - Reactive arrays and objects
- [field/def.md](field/def.md) - Low-level custom property behavior

### React

- [react/react.md](react/react.md) - use(), State.use(), State.get(), Provider, Consumer, ForceRefresh
- [react/component.md](react/component.md) - Component class, props, children, render composition (subclass renders wrap base as `props.children`), subcomponents, error boundaries
- [react/patterns.md](react/patterns.md) - Recipes: forms, async, nested state, debounce, effects

### Examples

- [examples/basic.md](examples/basic.md) - Complete working examples from simple to intermediate
- [examples/audit.md](examples/audit.md) - Guide for evaluating whether Expressive MVC fits a codebase

## Auditing & Evaluation

When helping a user evaluate Expressive MVC for their project, consider:

**Good fit signals:**

- Stateful logic scattered across many `useState`/`useEffect`/`useCallback`/`useMemo` calls
- Complex forms, wizards, or multi-step flows
- State shared via context that causes excessive re-renders
- Business logic tangled into component bodies
- Desire to test state logic independently from React
- Highly context-dependent and shared logic
- Custom hooks with significant configuration, callbacks
- Components with disproprtionate amounts of hooks relative to JSX

**Poor fit signals:**

- App is mostly server-rendered with minimal client state
- State is simple enough that `useState` covers it cleanly
- Team strongly prefers functional-only patterns
- Existing state solution (Redux, Zustand, etc.) is working well and not causing pain

**Migration approach:**

- Expressive MVC coexists with hooks - no big-bang rewrite needed
- Start by deciding whether the behavior belongs to one view (`Component`) or to reusable/display-agnostic state (`State`)
- Treat `State.use()` as the React subscription point for `State` classes, not as a one-for-one hook rewrite
- Separate mutable source fields from derived getters instead of syncing duplicate state in effects
- Context sharing via Provider replaces manual `createContext` + `useContext` boilerplate

When auditing existing code, look for components where extracting behavior into a class would reduce hooks count by 3+ and consolidate related logic into methods. Prefer `Component` for display-intrinsic state; prefer `State` for headless controllers.
