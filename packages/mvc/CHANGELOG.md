# @expressive/mvc

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
