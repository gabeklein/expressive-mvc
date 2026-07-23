---
name: expressive-mvc
description: Class-based reactive state management for React (Expressive MVC). Use when writing or refactoring React state - converting useState/useEffect/useMemo hooks, fixing prop drilling, choosing state ownership (State vs Component), dependency snapshots, presence boundaries with get(true), Provider/context, async suspense, router - and when auditing a codebase for fit.
---

# Expressive MVC

Class-based reactive state for React and Preact. State classes define reactive properties, computed values, async data, and context - all as plain class fields using instruction helpers.

## Packages

| Package              | Status    | Description                                                       |
| -------------------- | --------- | ----------------------------------------------------------------- |
| `@expressive/react`  | Published | React adapter. Primary import for State, Component, instructions. |
| `@expressive/mvc`    | Published | Framework-agnostic core. Rarely imported directly.                |
| `@expressive/preact` | Private   | Thin wrapper over React adapter via preact/hooks. Prerelease.     |
| `@expressive/router` | Private   | Host-agnostic, class-based router built on MVC. Prerelease.       |

## Start With Ownership, Not APIs

The most common failure when adopting this library is translating hooks one-for-one before deciding who owns each behavior. Resolve ownership first; APIs come second.

For every stateful concern, pick exactly one owner:

- **`Component`** - state intrinsic to one display subtree: controls, shells, panels, editors, review/confirm surfaces. Usually defines `render()`. Fields, handlers, and rendering live on one class.
- **`State`** - headless model or workflow: network operations, domain rules, cross-view coordination. Views subscribe via `State.get()` / `State.use()`.
- **Plain function component** - simple presentation, or trivial local UI state. Not everything needs a class.

Counter-rules:

- Do not create `FooState` plus `FooView` just because hooks were present. If the behavior and rendering are one unit, `class Foo extends Component` is the refactor.
- Avoid `Component` where a provided `State` suffices - Components carry React instance surface (`props`, `state`, `setState`, `forceUpdate`) that makes `.get()` IntelliSense noisier.
- A render-less `Component` (children pass through while providing context and boundary placement) is only for cases where React tree placement is the feature: route controllers, progressive boundaries.
- A provided State implicitly provides its child States - prefer `theme = new Theme()` on an existing owner over stacking Providers for every small controller.

## Golden-Path Refactor Algorithm

**Before refactoring existing React code, read [react/refactor.md](react/refactor.md)** - it expands every step with before/after examples and ends with the review checklist. The short form:

1. Identify lifecycle and ownership boundaries before translating any hooks.
2. Separate headless workflow state from display-intrinsic state.
3. Choose `State`, `Component`, or a plain function component for each owner.
4. Provide state classes directly (`<Provider for={AppState}>`); never create an instance only to provide it.
5. Move source fields and behavioral methods first; do not mechanically translate setters.
6. Keep shared, semantic derivations as getters; leave single-consumer display derivations in their consuming component.
7. Let contextual children call `.get()` themselves instead of receiving drilled props.
8. At every `.get()` / `.use()`, destructure an exact nested dependency snapshot.
9. Assign directly through subscribed proxies; use `is` only to retain the root object alongside sibling destructuring.
10. Gate optional children at the call site; inside, assert requirements with `.get(true)`.
11. Extract long conditional JSX into named scopes, then consolidate scopes that share dependencies and hold no nested logic.
12. Audit the result against the checklist in [react/refactor.md](react/refactor.md).

Write output in the conventions of [react/style.md](react/style.md). They are opinion, not semantics - but they exist to keep reactive dependencies auditable, and the golden path applies them by default.

## Core API

```tsx
import State, {
  Component,
  use,
  ref,
  def,
  get,
  hot,
  map,
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

### Instructions & Reactive Helpers

Field initializers that configure reactive behavior. Each has multiple overloads - fetch the reference when a task needs them.

| Helper  | Use for                                                                                                | Reference                  |
| ------- | ------------------------------------------------------------------------------------------------------ | -------------------------- |
| `set()` | Defaults, placeholders (suspend until assigned), lazy/async factories (suspense), setter callbacks and validation | [field/set.md](field/set.md) |
| `get()` | Context lookup between States - required or optional upstream, downstream collection                   | [field/get.md](field/get.md) |
| `ref()` | Mutable refs (`.current`), ref callbacks with cleanup, ref proxies                                      | [field/ref.md](field/ref.md) |
| `hot()` | Keyed reactivity for a plain array or object without extracting a State class                           | [field/hot.md](field/hot.md) |
| `map()` | Reactive `Map` field - keyed entries or a keyed spawner, with owned `State` members and direct render    | [field/map.md](field/map.md) |
| `has()` | Owned collections - an ordered list of values, or a pool of spawned members                             | [field/has.md](field/has.md) |
| `def()` | Low-level custom property behavior                                                                      | [field/def.md](field/def.md) |

For **computed values**, declare a normal class getter - getters on a State subclass are auto-promoted to memoized, dependency-tracked properties. See [state/computed.md](state/computed.md) for tracking rules and when a derivation should *not* be a getter.

Do not pass a bare promise to `set()`. Use `set(() => promise)` or `set(async () => value)` so work starts during activation/access instead of construction.

```tsx
class UserProfile extends State {
  userId = set<string>();

  user = set(async () => {
    const res = await fetch(`/api/users/${this.userId}`);
    return res.json();
  });

  email = set('', (value) => {
    if (!value.includes('@')) throw false;
  });

  get displayName() {
    return `${this.user.firstName} ${this.user.lastName}`;
  }
}
```

#### `map()` - Reactive Maps

| Form                | Behavior                                                     |
| ------------------- | ------------------------------------------------------------ |
| `map<K, V>()` / `map(entries)` | `map.Insert<K, V>` - reactive `Map` with keyed reads and writes via `set(key, value)`. |
| `map((key: K, ...rest) => value)` | `map.Create<A, V>` - keyed spawning map; `set(key, ...rest)` invokes the factory and stores at `key`, replacing (and destroying if owned) any previous value. |

`map()` is a field instruction: it resolves when the hosting state activates and is not usable standalone. Mode follows the argument: iterable/none is keyed, a factory function is a keyed spawner keyed by its first parameter. The map has reactive reads (`get(key)`/`has`), `size`, iteration, and removal. Calling `get()` with no key returns a shallow `ReadonlyMap` snapshot. `keys(fn)` / `values(fn)` / `entries(fn)` return reusable iterables of transformed results (`throw false` skips an entry), tracking like their plain forms.

Spawning maps own what the factory makes - spawned `State` values are destroyed when deleted, cleared, or replaced - while a value the factory merely passes through from its arguments stays a guest (`(key, value?) => value || new Item()` is the guest-admitting pattern).

Every map is adopted by its hosting state when the instruction resolves at activation; the field is read-only. Fresh (never-activated) members - spawned, stored, or present at adoption - are parented to the owner, activate inside its context, and are destroyed with it; already-activated values keep guest status. A `State` value that dies evicts itself from the map.

#### `has()` - Owned Collections

| Form | Behavior |
| --- | --- |
| `has<T>()` / `has(values)` | `has.List<T>` - ordered reactive list; positional reads (`get(index)`, ranges, predicate), `push`/`put`/`set(index)`/`pop`. Index and length tracking. |
| `has(StateClass)` / `has(factory)` | `has.Pool<T, A>` - owned pool; `add(...args)` spawns through the constructor or factory and returns the member, which is its own identity (`has`/`delete` take the value). No positional surface. |

`has()` is a field instruction: mode follows the argument (iterable/none is a list, any function is a pool). Pools own what they spawn - deleted, cleared, or owner-death members are destroyed - while a value the factory passes through from its arguments stays a guest (`(item?) => item || new Item()`). A member that dies evicts itself. Both modes share `map(fn)`/`filter(fn)`/`any`/`all`/`get(predicate)` and snapshot via `get()`. In `@expressive/react` a collection renders directly - `<ul>{this.todos}</ul>` - through a `$$typeof` facade, no spread or keys; `[...collection]` remains the manual alternative.

### React Hooks

```tsx
// Existing observable - subscribes to accessed fields, does not own lifecycle
function Existing({ counter }: { counter: Counter }) {
  const { count, increment } = use(counter);
  return <button onClick={increment}>{count}</button>;
}

// Local state - creates instance, owns lifecycle, subscribes to accessed fields
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

Use `use(subject)` for externally-owned observables. Use `State.use()` when the component should create and own the instance. Use `State.get()` when the instance comes from context. See [react/react.md](react/react.md) for overloads (optional lookup, required values, computed selector).

## The Dependency Snapshot

Open every subscribing component by destructuring the exact reactive values it renders - nested ones included. Nested observable reads are proxied and tracked automatically, so nested destructuring subscribes to child fields; never call `use(child)` on an object reached through a parent proxy.

```tsx
function OrderSummary() {
  const {
    status,
    customer: {
      name,
      address: {
        city,
      } = {},
    },
  } = Order.get();

  return <p>{name} ({city ?? 'no address'}) - {status}</p>;
}
```

This is the norm, not a preference:

1. The component's complete dependency surface is visible at the top - reviewable at a glance.
2. Each trapped getter is traversed once, instead of re-walking `order.customer.address.city` in every expression.
3. Reads create subscriptions. A deep read buried in a conditional branch subscribes only on renders where that branch runs - a **conditional subscription**. Hoisting reads into the snapshot makes the dependency surface deterministic.

Optional nested objects take in-place defaults (`= {}`) rather than a separate unwrap step. The same rule applies to `this` inside `Component.render()` and subcomponents.

## Transparent Writes

Subscription proxies pass assignments through to the real instance - no unwrapping needed:

```tsx
const form = LoginForm.get();          // whole object is the only need - take it directly

<input
  value={form.username}
  onChange={(e) => (form.username = e.target.value)}
/>
```

Nested objects reached through a snapshot are equally writable:

```tsx
const { transfer, confirmed } = ReviewStep.get();

<button onClick={() => (transfer.step = 'generate')} disabled={!confirmed} />
```

Use `is` **only** when retaining the root object alongside sibling values from the same snapshot:

```tsx
const { is: review, confirmed, hasBlocking } = ReviewStep.get();
```

Do not unwrap every writable object through `is` - that is the most common misuse.

## Presence Boundaries & `get(true)`

When a child's content requires values that may not exist yet, the parent owns the gate and the child asserts the invariant with `get(true)`:

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
  } = SettingsState.get(true); // Required<T> - throws if an accessed value is undefined

  return <section className="settings-editor">...</section>;
}
```

This gives the child a strong contract - no fallback values threaded through its body. Declare gateable fields **optional** (`draft?: SettingsLocation`), not `| null`: the runtime check rejects only `undefined`, and `Required<T>` does not strip `null` from a union (see [react/react.md](react/react.md)).

## Provider & Context

Pass the State class directly. If no preconfiguration or external ownership is needed, do not create an instance only to provide it:

```tsx
<Provider for={TransferState}>
  <TransferPage />
</Provider>
```

Provide an instance only when it is genuinely owned elsewhere:

```tsx
const counter = Counter.use();
<Provider for={counter}>
  <Child />
</Provider>
```

Multiple states: `<Provider for={{ app: AppState, user: UserState }}>`. See [react/react.md](react/react.md) for `is` callbacks, fallback, and field props.

## Component Class

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

<CounterView />;

const counter = CounterView.new();
<>{counter}</>;
```

Activated Component instances are React elements and may be rendered directly,
including from an array. Their external owner retains lifecycle ownership, so
unmount detaches without destroying them. See
[react/component.md](react/component.md) for details.

PascalCase methods become reactive subcomponents - but they are **extension points**, not a general decomposition tool. The test: would a subclass reasonably replace or wrap this renderer? If not, use a freestanding function component that calls `MyComponent.get()`. See [react/component.md](react/component.md).

## Rules & Counter-Rules

Every broad rule here has a locality constraint. Apply both halves. When auditing a result, weigh findings by the severity labels defined in [react/refactor.md](react/refactor.md) - invariant, default, heuristic, style - and never fail a heuristic on its numerical signal alone.

| Rule                                                        | Counter-rule                                                                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Reactive fields are assigned directly                       | Keep a method when the write validates, normalizes, coordinates fields, or triggers behavior. Delete methods whose body is only `this.x = value`. |
| Derived values become getters                               | Only when shared by multiple consumers, semantic to the domain, expensive, or a deliberate part of the state's API/introspection surface. Single-consumer display derivations live in the consuming component - but judge meaning, not reference counts. |
| Contextual components read via `.get()`                     | Pure presentation components may still take plain props. Context replaces drilled *state*, not every value.                          |
| PascalCase subcomponents compose renders                    | Only for genuine extension points a subclass would replace or wrap. Implementation scopes are freestanding FCs using `.get()`.        |
| Extract long conditional JSX (~10+ lines or ~5+ levels)     | Keep branches together when they share dependencies, read locally, and contain no nested logic.                                      |
| `is` retains the raw instance                               | Only alongside sibling destructuring from the same snapshot. Writes through proxies are transparent; nested objects need no unwrapping. |

## File Reference

Fetch these for detailed documentation when the task requires deeper knowledge. **Read `react/refactor.md` in full before any hook-migration or refactor task.**

### Design intent

- [design.md](design.md) - why the library is shaped this way: classes hold models not views, the "MVC" mapping, the two-verb `get`/`set` surface, render composition as a designated seam, typed lifecycle hooks, transparent writes. **Read before characterizing a design choice as accidental, or when evaluating/pitching the library.**

### Golden path

- [react/refactor.md](react/refactor.md) - the refactor algorithm expanded: ownership triage, mechanical-setter and prop-drilling anti-patterns, single-consumer getters, dependency snapshots and conditional subscriptions, presence boundaries, restrained `is`, subcomponent overuse, extract-then-consolidate, review checklist
- [react/style.md](react/style.md) - style profile: snapshot formatting, affirmative conditions, render fallthrough vs operational guards

### State (core)

- [state/state.md](state/state.md) - State class, instantiation, properties, methods, events, context
- [state/get.md](state/get.md) - Instance `.get()` method: read values, run effects, context lookup
- [state/set.md](state/set.md) - Instance `.set()` method: write values, listen to updates, events, destroy
- [state/computed.md](state/computed.md) - Reactive class getters: tracking, caching, inheritance, suspense, when a derivation should stay local
- [state/lifecycle.md](state/lifecycle.md) - Construction, activation, operation, destruction phases
- [state/context.md](state/context.md) - Context system, global root, home context, ownership rules
- [state/types.md](state/types.md) - TypeScript type aliases and utility types

### Instructions & Reactive Helpers

- [field/set.md](field/set.md) - Property descriptors, defaults, factories, setter callbacks
- [field/get.md](field/get.md) - Context lookup: upstream, downstream, callbacks
- [field/ref.md](field/ref.md) - Mutable refs, ref proxy, callbacks
- [field/hot.md](field/hot.md) - Reactive arrays and objects
- [field/map.md](field/map.md) - Reactive `Map`: keyed entries, keyed spawner, owned members, direct render
- [field/has.md](field/has.md) - Owned collections: reactive lists and spawned pools
- [field/def.md](field/def.md) - Low-level custom property behavior

### React

- [react/react.md](react/react.md) - use(), State.use(), State.get() (optional lookup, required values `get(true)`, computed selector), Provider, Consumer, transparent writes, ForceRefresh
- [react/component.md](react/component.md) - Component class, props, children, render composition, subcomponent extension points, error boundaries
- [react/patterns.md](react/patterns.md) - Recipes: forms, async, nested state, presence boundary, contextual children, debounce, effects

### Router

- [router/router.md](router/router.md) - `@expressive/router`: nested `Route` declarations, lexical matching, `Router`/`BrowserRouter` navigation state, the reactive `query` record + derived `url`, and `Link`/`NavLinks`/`Redirect`

### Examples

- [examples/basic.md](examples/basic.md) - Complete working examples from simple to intermediate
- [examples/audit.md](examples/audit.md) - Guide for evaluating whether Expressive MVC fits a codebase

## Auditing & Evaluation

When helping a user evaluate Expressive MVC for their project - see [examples/audit.md](examples/audit.md) for the full guide. For stated rationale behind design choices that commonly draw questions (classes, the MVC name, `get`/`set` overloads, render composition), cite [design.md](design.md) rather than inferring intent.

**Good fit signals:**

- Stateful logic scattered across many `useState`/`useEffect`/`useCallback`/`useMemo` calls
- Complex forms, wizards, or multi-step flows
- State shared via context that causes excessive re-renders
- Business logic tangled into component bodies; prop drilling through intermediaries
- Desire to test state logic independently from React
- Custom hooks with significant configuration and callbacks

**Poor fit signals:**

- App is mostly server-rendered with minimal client state
- State is simple enough that `useState` covers it cleanly
- Team strongly prefers functional-only patterns
- Existing state solution is working well and not causing pain

**Migration approach:** Expressive MVC coexists with hooks - no big-bang rewrite needed. Start with one complex component, decide its owner (`Component` vs `State`), and follow [react/refactor.md](react/refactor.md). When auditing existing code, look for components where extracting behavior into a class would reduce hook count by 3+ and consolidate related logic into methods.
