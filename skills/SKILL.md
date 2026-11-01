---
name: expressive-mvc
description: Class-based state backbone for UI apps (Expressive MVC) - reactive MVC in plain classes that React or @expressive/dom renders. Use when writing or refactoring React state - converting useState/useEffect/useMemo hooks, fixing prop drilling, choosing state ownership (Model vs Component, has-pool domain rows, region controls), dependency snapshots, presence boundaries, providing context, async suspense, router - and when auditing a codebase for fit.
---

# Expressive MVC

A class-based state backbone - reactive MVC in plain classes, rendered by React or `@expressive/dom`. Model classes define reactive properties, computed values, async data, and context - all as plain class fields using instruction helpers.

## Packages

| Package              | Status    | Description                                                       |
| -------------------- | --------- | ----------------------------------------------------------------- |
| `@expressive/mvc`    | Published | Framework-agnostic core. Primary import for Model, Component, instructions. |
| `@expressive/react`  | Published | React adapter. Supplies the host.                                 |
| `@expressive/dom`    | Preview   | MVC-native client DOM renderer without a framework dependency.     |
| `@expressive/preact` | Private   | Thin wrapper over React adapter via preact/hooks. Prerelease.     |
| `@expressive/router` | Published | Host-agnostic, class-based router built on MVC.                   |
| `@expressive/inspect` | Published | In-process inspector: registry, ownership tree, path queries, journal. |

### Installing

```bash
npm install @expressive/mvc @expressive/react    # + @expressive/router for routing
```

`@expressive/mvc` is a peer dependency - add it to `package.json` and import `Model`, `Component` and every instruction from it, whatever the host. `@expressive/react` supplies the host: import it once from your entry module so it registers. It exports nothing for app code - import `{ Model }` by name from the core; adapter-augmented `Model.*` types are invisible through the core's deprecated default export.

React Native / Expo need no setup beyond three boundaries ([react/react.md](react/react.md#react-native)): add `@expressive` to `jest-expo`'s `transformIgnorePatterns`; use `Router`, not `BrowserRouter`; `Link`/`NavLinks` render DOM, so navigate through `Router`.

For a client-only DOM app without React, install `@expressive/mvc` and `@expressive/dom`. `@expressive/dom` is a sidecar and re-exports nothing - `Model`, `Component` and instructions come from `@expressive/mvc`, while `render`, `Portal`, `style` and `macro` come from `@expressive/dom`. Its FC semantics, renderer API, portals, code splitting, and transition constraints are in [dom/dom.md](dom/dom.md).

## Start With Ownership, Not APIs

The most common failure when adopting this library is translating hooks one-for-one before deciding who owns each behavior. Resolve ownership first; APIs come second.

For every stateful concern, pick exactly one owner:

- **`Component`** - state intrinsic to one display subtree: inputs, panels, editors, review/confirm surfaces. Usually defines `render()`. Fields, handlers, and rendering live on one class. House style: the app entry is an FC - pure composition, with a last-resort boundary as `fallback`/`catch` on the top Component it mounts (`<Layout fallback={null}>`, `<BrowserRouter fallback={null}>`). App-wide state is Models owned by a render-less `Global` Component the app entry mounts at the top - it provides them to everything below. Its job is making `Session.get()` work anywhere, not being read itself - `Global.get().session` works but isn't the goal.
- **`Model`** - headless domain model or workflow: network operations, domain rules, cross-view coordination. Views subscribe via `Model.get()`; an owning Component holds it as a field. Two roles: a *domain model* (`Cart`, `Message`, a pool row) outlives any one placement; a *control* (`Control`, `<Feature>Control` in apps) is constructed where a page, region or route places it, holds domain models as fields, and translates gestures into operations on them. Name a class for what it holds - `<Thing>State` and `<Feature>Control` are both fine, case by case.
- **Plain function component** - simple presentation, or trivial local UI state. Not everything needs a class.

Concerns include the rows: UI state describing an entry in a collection - selection, status, progress - is its own `Model` or `Component` spawned in a `has` pool; actions about item belong on item. Id-keyed fields (`Record<Id, T>`, parallel `Map`s) and `(id, value)` methods are a missing class; subsets are a second pool admitting the same members.

Counter-rules:

- Do not create `FooState` plus `FooView` just because hooks were present. If the behavior and rendering are one unit, `class Foo extends Component` is the refactor.
- Avoid `Component` where a provided `Model` suffices - Components carry React instance surface (`props`, `state`, `setState`, `forceUpdate`) that makes `.get()` IntelliSense noisier.
- Prefer an FC over `Component` when state is zero or reducible and no boundary is wanted - a class holding only `get(...)` fields plus `render()` is an FC snapshotting `.get()`.
- A render-less `Component` (children pass through while providing context and boundary placement) is only for cases where React tree placement is the feature: route controls, progressive boundaries.
- A provided instance implicitly provides its child instances - prefer `theme = new Theme()` on an existing owner over stacking `<Component for>` elements for every small control.

## Golden-Path Refactor Algorithm

**Before refactoring existing React code, read [react/refactor.md](react/refactor.md)** - it expands every step with before/after examples and ends with the review checklist. The short form:

1. Identify lifecycle and ownership boundaries before translating any hooks.
2. Separate headless workflow state from display-intrinsic state.
3. Choose `Model`, `Component`, or a plain function component for each owner.
4. Give every repeated UI entry own class in a `has` pool; actions about item belong on item.
5. Split unrelated clusters remaining on page control to owned region controls `composer = new Composer()`. Bias one concern per class - barrels are deliberate (page orchestrator, pool owner, mounting shell); shed a second concern the moment it appears, growing a feature or refactoring one alike.
6. Provide classes directly `<Component for={AppState}>` never an instance if only to provide it; a page Component's own fields provide implicitly - mount `<Inbox />` bare.
7. Move source fields and behavioral methods first; do not mechanically translate setters.
8. Keep shared, semantic derivations as getters; leave single-consumer display derivations in their consuming component.
9. Let contextual children call `.get()` instead of receiving drilled props.
10. At every `.get()` and `render()`, destructure for exact nested dependency snapshot.
11. May assign thru subscribed proxies; `is` only to retain the root object alongside sibling destructuring.
12. A gated widget mounts unconditionally and gates itself, falling thru when unset; where the parent reads the field for its own content, the gated value is a Model field and the child reads it with `.get()`.
13. Split `render()` and long JSX at conditionals and non-interacting siblings into honestly-named local FCs - units you'd delete or move whole; one-op conditionals and formatted scalars stay inline. Consolidate scopes that share dependencies and hold no nested logic.
14. Audit the result against the checklist in [react/refactor.md](react/refactor.md).

For large apps, scope a one-shot conversion to route/page controls and their domain pools; leave mature leaf widgets on hooks until parent domains stabilize.

Write output in the conventions of [react/style.md](react/style.md). They are opinion, not semantics - but they exist to keep reactive dependencies auditable, and the golden path applies them by default.

## Core API

```tsx
import { Model, Component, ref, def, get, has, map, pending, set } from '@expressive/mvc';
import '@expressive/react'; // once, in the entry module
```

### Model Class

Extend `Model` to define reactive classes. Use `Model.new()` to construct a root instance - it constructs *and* activates, which plain `new` does not. Bare `new` is correct in one place: a class field on another Model (`theme = new Theme()`), where the owner adopts and activates the child, and destroys it in turn.

```tsx
class Counter extends Model {
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
| `get()` | Context lookup between instances - required or optional upstream, downstream collection, override key | [field/get.md](field/get.md) |
| `ref()` | Mutable refs (`.current`), ref callbacks with cleanup, ref proxies                                      | [field/ref.md](field/ref.md) |
| `map()` | Reactive `Map` field - keyed entries or a keyed spawner, with owned `Model` members and direct render    | [field/map.md](field/map.md) |
| `has()` | Owned collections - an ordered list of values, or a pool of spawned members. Pools are for per-item UI state (selection, progress, row actions). Class first (`has(Row)`); factory when the seed isn't the init | [field/has.md](field/has.md) |
| `def()` | Low-level custom property behavior                                                                      | [field/def.md](field/def.md) |

For **computed values**, declare a normal class getter - getters on a Model subclass are auto-promoted to memoized, dependency-tracked properties. See [state/computed.md](state/computed.md) for tracking rules and when a derivation should *not* be a getter.

`pending(work)` is not a field helper but imports alongside them - it marks the updates `work` queues non-urgent and resolves once every reader has taken them. See [Transitions](react/component.md#transitions).

Do not pass a bare promise to `set()`. Use `set(() => promise)` or `set(async () => value)` so work starts during activation/access instead of construction.

```tsx
class UserProfile extends Model {
  userId = set<string>();

  user = set(async () => {
    const res = await fetch(`/api/users/${this.userId}`);
    return res.json();
  });

  bio = set('', (value) => {
    if (value.length > 280) throw false; // never stored - write rejected
  });

  get displayName() {
    return `${this.user.firstName} ${this.user.lastName}`;
  }
}
```

### React Views

```tsx
// Owned state - a Component; render subscribes to what it reads
class Counter extends Component {
  count = 0;
  increment() {
    this.count++;
  }

  render() {
    const { count, increment } = this;
    return <button onClick={increment}>{count}</button>;
  }
}

// Context state - reads nearest provided instance, subscribes reactively
function Child() {
  const { count } = Counter.get();
  return <span>{count}</span>;
}

// An instance you already hold - place it; it renders and subscribes itself
function Parent({ counter }: { counter: Counter }) {
  return <section>{counter}</section>;
}
```

Static `.get()` is a React hook - call unconditionally at the top of a component or `render()`, never inside branch, event handlers, or loops. Outside render it resolves root, untracked - no error, possibly the wrong instance; a handler uses what the render's snapshot destructured. (Instance method get is not a hook.)

State a view owns is a `Component`, or `<Component for={X}>` above FCs calling `X.get()` when a subtree shares it - FCs own nothing. Use `Model.get()` when the instance comes from context. To render an instance you already hold, make it a `Component` and place as `{instance}` - subscription belongs to the placed instance, not the surrounding function. See [react/react.md](react/react.md) for optional lookup, presence boundaries and custom lookup.

## The Dependency Snapshot

Open every subscribing component by destructuring the exact reactive values it renders - nested ones included. Nested observable reads are proxied and tracked automatically, so nested destructuring subscribes to child fields; a child reached through a parent proxy needs no separate subscription.

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

Optional nested objects take in-place defaults (`= {}`) rather than a separate unwrap step. The same rule applies to `this` inside `Component.render()` and subcomponents - injected parents (`inbox = get(Inbox)`) are read thru that snapshot, never a second `Inbox.get()`.

## Transparent Writes

Proxies pass assignments through to the instance, nested objects included - no unwrapping:

```tsx
const form = LoginForm.get();                   // whole object needed - take it directly
<input value={form.username} onChange={(e) => (form.username = e.target.value)} />

const { transfer, confirmed } = ReviewStep.get();
<button onClick={() => (transfer.step = 'generate')} disabled={!confirmed} />

const { is: review, confirmed, hasBlocking } = ReviewStep.get();  // `is`: root beside siblings
```

`is` is **only** for keeping the root alongside sibling destructuring. Unwrapping every writable object through it is the most common misuse.

## Presence Boundaries

Default: a self-contained widget mounts unconditionally, reads its own context, and falls thru when its reason to render is unset - a parent read existing only to gate belongs in the widget. The secondary shape, when the parent reads the field for its own content: the gated value is a Model field (`draft?: Draft`), which joins its owner's context - parent gates, child reads it with `Draft.get()`:

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
    bankAccount,
    categoryAccounts,
  } = Draft.get();

  const {
    saveSettings,
    saving,
  } = SettingsState.get();

  return <section className="settings-editor">...</section>;
}
```

The child renders only where the instance exists - no fallback values threaded through its body, no Model values passed as props. A gated value with one view of its own is a `Component`, placed as `{draft}`. Both shapes in full: [react/refactor.md](react/refactor.md) step 12.

## Providing Context

Pass the class: `<Component for={TransferState}>`. Pass an instance only when something else owns it (`<Component for={row}>` for a pool member). One item per element - several belong to a parent instance owning them as fields, which makes them siblings; nesting `<Component for>` is a smell (the outer cannot `get` the inner). `is`, attributes, boundaries: [state/context.md](state/context.md#providing-with-component).

## Component Class

A `Component` is a `Model` usable in JSX. It provides context automatically and supports suspense/error boundaries.

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

An activated instance renders directly, arrays included; its owner keeps lifecycle, so unmount detaches without destroying.

PascalCase methods become reactive subcomponents - **extension points** a subclass would replace or wrap, not general decomposition. Otherwise write a freestanding FC calling `MyComponent.get()`. Details: [react/component.md](react/component.md).

## Rules & Counter-Rules

Every broad rule here has a locality constraint. Apply both halves. When auditing a result, weigh findings by the severity labels defined in [react/refactor.md](react/refactor.md) - invariant, default, heuristic, style - and never fail a heuristic on its numerical signal alone.

| Rule                                                        | Counter-rule                                                                                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Reactive fields are assigned directly                       | Keep a method when the write validates, normalizes, coordinates fields, or triggers behavior. Delete methods whose body is only `this.x = value`. |
| Derived values become getters                               | Only when shared by multiple consumers, semantic to the domain, expensive, or a deliberate part of the instance's API/introspection surface. Single-consumer display derivations live in the consuming component - but judge meaning, not reference counts. |
| Contextual components read via `.get()`                     | Pure presentation components may still take plain props. Context replaces drilled *state*, not every value.                          |
| PascalCase subcomponents compose renders                    | Only for genuine extension points a subclass would replace or wrap. Implementation scopes are freestanding FCs using `.get()`.        |
| Extract long conditional JSX (~10+ lines or ~5+ levels)     | Keep branches together when they share dependencies, read locally, and contain no nested logic.                                      |
| `is` retains the raw instance                               | Only alongside sibling destructuring from the same snapshot. Writes through proxies are transparent; nested objects need no unwrapping. |
| State about a collection entry lives on the entry's class   | Payload keys that never drive UI stay as one `info` subobject on the member - a reactive field without a reader is pure cost.           |

## File Reference

Fetch these for detailed documentation when the task requires deeper knowledge. **Read `react/refactor.md` in full before any hook-migration or refactor task.**

### Design intent

- [design.md](design.md) - why the library is shaped this way: classes hold the model layer not views, the "MVC" mapping, the two-verb `get`/`set` surface, render as an ordinary override, typed lifecycle hooks, transparent writes. **Read before characterizing a design choice as accidental.** For positioning against alternatives (Zustand, Jotai, MobX, Redux Toolkit, plain Context), see [expressive.dev/llm/comparisons.md](https://expressive.dev/llm/comparisons.md).

### Golden path

- [react/refactor.md](react/refactor.md) - the refactor algorithm expanded: ownership triage, mechanical-setter and prop-drilling anti-patterns, single-consumer getters, dependency snapshots and conditional subscriptions, presence boundaries, restrained `is`, subcomponent overuse, extract-then-consolidate, review checklist
- [react/style.md](react/style.md) - style profile: snapshot formatting, affirmative conditions, render fallthrough vs operational guards

### Model (core)

- [state/state.md](state/state.md) - Model class, instantiation, properties, methods, events, context
- [state/get.md](state/get.md) - Instance `.get()` method: read values, run effects, context lookup; static `get` and overriding it
- [state/set.md](state/set.md) - Instance `.set()` method: write values, listen to updates, events, destroy
- [state/computed.md](state/computed.md) - Reactive class getters: tracking, caching, inheritance, suspense, when a derivation should stay local
- [state/lifecycle.md](state/lifecycle.md) - Construction, activation, operation, destruction phases; hot patching and the `hot` seam
- [state/context.md](state/context.md) - Context system, root context, home context, ownership rules, `Context.get`/`resolve`, writing a host
- [state/types.md](state/types.md) - TypeScript type aliases and utility types

Instructions: `field/*.md`, linked from the [helper table](#instructions--reactive-helpers).

### React

- [react/react.md](react/react.md) - Model.get() (optional lookup, presence boundaries, custom lookup), mount(), providing state, transparent writes, SSR, Vite hot reload
- [react/component.md](react/component.md) - Component class, props, children, extending a base, subcomponent extension points, error boundaries
- [react/patterns.md](react/patterns.md) - Recipes: forms, async, domain-row and form-chip pools, region controls, router bridge, host-agnostic domain model + view adapter, presence boundary, contextual children, debounce, async effects, awaiting a pending value, effects

### JSX

- [dom/dom.md](dom/dom.md) - client DOM render/unmount, stateless FC scopes, MVC snapshots, native events, portals, lazy boundaries, transitions, Vite hot reload, exclusions

### Router

- [router/router.md](router/router.md) - route declarations, lexical matching, guards, Suspense, navigation state, and UI
- [router/production.md](router/production.md) - choose `Router` vs `BrowserRouter`, page-data ownership, navigation settlement, testing, host boundaries, and unsupported browser behavior

### Inspect

- [inspect.md](inspect.md) - `@expressive/inspect`: install entry, instances in process vs addresses across a boundary, ownership, stored-value reads with `absent`, labels under minification, frame journal with `cause`, `act`, orphans and `health()`, bridge and Vite relay

### Examples

- [examples/basic.md](examples/basic.md) - Complete working examples from simple to intermediate
- [examples/audit.md](examples/audit.md) - Guide for evaluating whether Expressive MVC fits a codebase

**Runnable examples** - optional; this skill is complete offline. `https://expressive.dev/examples/<group>/<name>` serves a working program's every source file as plain HTML (no JS needed). Fetch one for a full reference implementation rather than a snippet:

| Group | Pages |
| --- | --- |
| `featured` | `forms`, `kanban`, `spreadsheet`, `stopwatch`, `store`, `tictactoe`, `todomvc` |
| `essentials` | `counter`, `computed`, `fetch`, `async`, `async-effect`, `await-effect`, `private`, `unmanaged` |
| `component` | `props`, `subcomponents`, `lifecycle`, `injection`, `headless`, `suspense`, `boundary`, `custom` |
| `composition` | `nested`, `context`, `concerns`, `globals` |
| `instructions` | `set`, `set-factory`, `set-computed`, `get`, `get-downstream`, `ref`, `ref-multiple`, `map`, `map-insert`, `has`, `has-list`, `def` |
| `router` | `overview`, `browser`, `params`, `query`, `guards`, `transitions`, `nav`, `wizard` |

## Auditing & Evaluation

Audit a conversion as a separate pass over the diff - self-audits while authoring under-report architecture gaps.

Fit and migration candidates: [examples/audit.md](examples/audit.md); approved migrations follow [react/refactor.md](react/refactor.md). Positioning: website-only [why](https://expressive.dev/llm/why.md), [comparisons](https://expressive.dev/llm/comparisons.md), and [dom vs React](https://expressive.dev/llm/dom.md).
