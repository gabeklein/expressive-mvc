# @expressive/mvc

## 0.80.1

### Patch Changes

- [#212](https://github.com/gabeklein/expressive-mvc/pull/212) [`b37b918`](https://github.com/gabeklein/expressive-mvc/commit/b37b918800f569029c297e9e5b6d458fdb723fea) Fix a dropped refresh when an observer is re-notified within the same dispatch tick. The batched event queue coalesced handlers by identity and drained with `Set.forEach`, so a handler re-enqueued after it had already run in the current tick was silently skipped. This stranded a `.get()` subscription that observed both a field and a computed derived from that field (the field's change and the computed's recompute land in one tick): the component refreshed once, then froze. The queue now removes each handler before invoking it, so a same-tick re-enqueue runs again.

## 0.80.0

### Minor Changes

- [#196](https://github.com/gabeklein/expressive-mvc/pull/196) [`df90954`](https://github.com/gabeklein/expressive-mvc/commit/df90954199df6c06b4af3962bbd53fb8837c2d99) Move the low-level observable protocol (`observer`, `touch`, `event`, `listener`, `watch`, `Observer`) off the main entry to a dedicated `@expressive/mvc/observable` subpath. This declutters the primary import surface, which is now the app-facing API (`State`, `Component`, `Context`, instructions). The protocol is power-user surface for building custom observables; import it explicitly:

  ```ts
  import { watch, touch, event } from '@expressive/mvc/observable';
  ```

  Breaking: these names are no longer exported from `@expressive/mvc`, and `@expressive/react` no longer re-exports `Observer` from its main entry. Update imports to the subpath.

### Patch Changes

- [#199](https://github.com/gabeklein/expressive-mvc/pull/199) [`de44e86`](https://github.com/gabeklein/expressive-mvc/commit/de44e86111c9eec6e5b0813174adfd34b15db158) Fix prop assignment throwing when a prop shares the name of a read-only (getter-derived) computed. Such a key previously hit the computed's throwing setter and dropped the value; it is now skipped during assignment, leaving the computed to derive it.

## 0.79.1

### Patch Changes

- [#188](https://github.com/gabeklein/expressive-mvc/pull/188) [`077f9e5`](https://github.com/gabeklein/expressive-mvc/commit/077f9e59bacb99e64036244501090fa8e44c82bb) Fix stack overflow in `get()` snapshots when the model graph has a cycle not passing through root state.

## 0.79.0

### Minor Changes

- [#185](https://github.com/gabeklein/expressive-mvc/pull/185) [`fbd3f0c`](https://github.com/gabeklein/expressive-mvc/commit/fbd3f0c72e88da755bec7e58081947b67ee837e0) `set` now defines a reactive computed property when passed a function that takes an argument - the instruction equivalent of a class getter. `set(self => self.first + ' ' + self.last)` re-runs whenever a managed property it reads updates, receiving the instance as both `this` and its first argument. It is enumerable and read-only, matching a prototype getter.

  Dispatch is by arity: a zero-arg function (`set(() => ...)`) keeps its existing behavior as a one-shot lazy factory, while a function declaring a parameter routes into the reactive compute engine. This exposes getter behavior through an instruction, so it can be composed or wrapped, and - because the property is instruction-assigned rather than a concrete getter - a subclass may refine its type with `declare`, which a generic getter on a parent class cannot express.

## 0.78.1

### Patch Changes

- [#166](https://github.com/gabeklein/expressive-mvc/pull/166) [`62d242b`](https://github.com/gabeklein/expressive-mvc/commit/62d242bf65382edb233db7748f00f7463e1c9606) fix: keep overridden `render` valid as JSX when consuming built packages

  When `@expressive/router` was consumed as a built package (outside the monorepo), `<Route>`, `<Link>`, and `<NavLinks>` failed type-checking as JSX (`TS2786`). Their `render` overrides had no explicit return type, so the `.d.ts` emitter baked the host-seam alias's build-time fallback (`unknown`) into the published types, which is not assignable to `ReactNode`.

  Two changes fix this:

  - `@expressive/router`: the overridden `render` methods are annotated `: Component.Node`, so the emitter preserves the deferred alias by reference and it re-resolves to the host node type (e.g. `ReactNode`) in a consumer.
  - `@expressive/mvc`: `Component.Node` now falls back to `any` instead of `unknown`. `any` is the only fallback assignable to every host's node type, so an un-annotated `render` override in any host-agnostic package still emits a JSX-valid return.

## 0.78.0

### Minor Changes

- [#161](https://github.com/gabeklein/expressive-mvc/pull/161) [`08b85ec`](https://github.com/gabeklein/expressive-mvc/commit/08b85ecfa0a16620f0851d8e2b2f79c805002050) **Milestone release.** `@expressive/mvc` now ships the renderer-agnostic `Component`, completing the "MVC" the package is named for. This is the first publish since `0.73.1` and folds in a large body of architectural work.

  **`Component` in core ([#100](https://github.com/gabeklein/expressive-mvc/issues/100), [#111](https://github.com/gabeklein/expressive-mvc/issues/111)).** The reactive `Component` - previously living in `@expressive/react` - is now a layer on `State` in the core package. A renderer is no longer assumed: `@expressive/react` becomes a thin adapter that completes the class through documented seams. Subclasses may override `render` and have it **compose up the prototype chain** with no `super.render()` call - each ancestor wraps the subclass output as `children`, base-outermost, lazily and reactively ([#111](https://github.com/gabeklein/expressive-mvc/issues/111), breaking).

  **Host-agnostic JSX runtime ([#127](https://github.com/gabeklein/expressive-mvc/issues/127)).** `@expressive/mvc` is now a standalone JSX pragma (`jsxImportSource: "@expressive/mvc"`). The new `@expressive/mvc/jsx-runtime` entry forwards `jsx`/`jsxs`/`jsxDEV`/`Fragment` to a host table registered by an adapter (one host per build). Element-introspection helpers (`childrenOf`/`isElement`/`typeOf`/`propsOf`) let agnostic libraries walk JSX without a renderer.

  **Reactive collections ([#78](https://github.com/gabeklein/expressive-mvc/issues/78)).** New `hot()` helper - a shallow reactive proxy for arrays/objects with keyed read-subscription and native mutating methods.

  **Robustness.** Reads of a destroyed instance now settle to last-known values instead of throwing, while writes and subscriptions stay loud ([#121](https://github.com/gabeklein/expressive-mvc/issues/121)); instances discarded before a React commit are now destroyed ([#122](https://github.com/gabeklein/expressive-mvc/issues/122)).

  **Breaking / surface changes.**

  - Package renamed back to `@expressive/mvc` from the interim `@expressive/state` ([#104](https://github.com/gabeklein/expressive-mvc/issues/104)).
  - `Observable` export renamed to `Observer` ([#151](https://github.com/gabeklein/expressive-mvc/issues/151)).
  - Removed the redundant `get(key, callback)` overload; use `set()` for event listening ([#102](https://github.com/gabeklein/expressive-mvc/issues/102)).
  - ESM-only; CJS output dropped ([#79](https://github.com/gabeklein/expressive-mvc/issues/79)).

- [#143](https://github.com/gabeklein/expressive-mvc/pull/143) [`92cc04c`](https://github.com/gabeklein/expressive-mvc/commit/92cc04c87441204dac809d304231839ae56f178d) `State.on` now accepts a handler object in addition to the existing init callback, hooking distinct points of the class/instance lifecycle by cadence:

  - `type` - per-class, runs once when the class is first bootstrapped, before its members are classified; receives the class so a handler may inspect or reshape the prototype first. A base-class handler runs for each subclass.
  - `before` - per-instance, runs in the `prepare` phase before `observe`/`new()` (equivalent to a bare function).
  - `after` - per-instance, runs at the `new()` slot after own values are observed; may return a cleanup.

  The bare function overload is unchanged.

  Additionally, bootstrap no longer reactively binds a non-configurable own member. This lets an adapter claim a member by sealing it in a `type` handler (e.g. keeping a Component's `render` unbound for the render chain) and mirrors the existing getter behaviour, which only binds configurable getters.

- [#158](https://github.com/gabeklein/expressive-mvc/pull/158) [`742c685`](https://github.com/gabeklein/expressive-mvc/commit/742c68508320751b92a4ab3fc4dfa64b62e176a8) Exclude non-settable members from inferred JSX props.

  `Component.StateProps` now drops get-only accessors and `readonly` fields from the prop surface a component accepts. These members can never be meaningfully assigned from JSX, so offering them as props only invited no-op or type-erroring assignments. Writable fields, get/set accessors, callbacks, and methods are unaffected.

  The exclusion is the one structurally-detectable case (via a `readonly`-probe); TypeScript cannot distinguish a method from a callback field, so a blanket function exclusion is intentionally not attempted. The new behavior is consistent with `set`, which already rejects `readonly` keys.
