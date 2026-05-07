---
name: expressive-state
description: Class-based reactive state management for React. Covers State API, instructions, Component class, lifecycle, patterns, and codebase auditing.
---

# Expressive State

Class-based reactive state for React, Preact, and Solid. State classes define reactive properties, computed values, async data, and context - all as plain class fields using instruction helpers.

## Packages

| Package              | Status    | Description                                                       |
| -------------------- | --------- | ----------------------------------------------------------------- |
| `@expressive/react`  | Published | React adapter. Primary import for State, Component, instructions. |
| `@expressive/state`  | Published | Framework-agnostic core. Rarely imported directly.                |
| `@expressive/preact` | Private   | Thin wrapper over React adapter via preact/hooks. Prerelease.     |
| `@expressive/solid`  | Private   | Standalone implementation. Experimental.                          |

## Core API

```tsx
import State, {
  Component,
  ref,
  def,
  get,
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

### Instructions

Field initializers that configure reactive behavior. Each has multiple overloads - see linked docs for full details.

#### `set()` - Values, Factories & Validation

| Form                  | Behavior                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| `set<T>()`            | Placeholder. Suspends on access until assigned.                             |
| `set(value)`          | Default value. Non-enumerable, writable.                                    |
| `set(value, cb)`      | Default with setter callback. `throw false` to reject.                      |
| `set(() => v)`        | Lazy factory. Read-only. Async suspends.                                    |
| `set(async () => v)`  | Async factory. Suspends until resolved.                                     |
| `set(() => v, true)`  | Eager factory. Runs immediately on init.                                    |
| `set(() => v, false)` | Lazy factory. Returns `undefined` while pending (no suspense).              |
| `set(() => v, cb)`    | Factory with setter callback. Makes writable.                               |
| `set(promise)`        | Direct promise. Suspends until resolved.                                    |

For **reactive computed values**, declare a normal class getter (e.g. `get total() { ... }`). Getters on a State subclass are auto-promoted to memoized, dependency-tracked properties.

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

#### `def()` - Custom Property

| Form           | Behavior                                                                                        |
| -------------- | ----------------------------------------------------------------------------------------------- |
| `def(factory)` | Low-level. Factory receives `(key, subject, state)`. Return config object, cleanup fn, or void. |

### React Hooks

```tsx
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

### Instructions (field initializers)

- [instructions/set.md](instructions/set.md) - Property descriptors, defaults, factories, setter callbacks
- [instructions/get.md](instructions/get.md) - Context lookup: upstream, downstream, callbacks
- [instructions/ref.md](instructions/ref.md) - Mutable refs, ref proxy, callbacks
- [instructions/def.md](instructions/def.md) - Low-level custom property behavior

### React

- [react/react.md](react/react.md) - State.use(), State.get(), Provider, Consumer, ForceRefresh
- [react/component.md](react/component.md) - Component class, props, children, subcomponents, error boundaries
- [react/patterns.md](react/patterns.md) - Recipes: forms, async, nested state, debounce, effects

### Examples

- [examples/basic.md](examples/basic.md) - Complete working examples from simple to intermediate
- [examples/audit.md](examples/audit.md) - Guide for evaluating whether Expressive State fits a codebase

## Auditing & Evaluation

When helping a user evaluate Expressive State for their project, consider:

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

- Expressive State coexists with hooks - no big-bang rewrite needed
- Start by extracting one complex component's state into a State class
- Use `State.use()` as a drop-in replacement for grouped `useState` calls
- Context sharing via Provider replaces manual `createContext` + `useContext` boilerplate

When auditing existing code, look for components where extracting a State class would reduce hooks count by 3+ and consolidate related logic into methods.
