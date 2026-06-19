# @expressive/react

## 0.79.0

### Minor Changes

- [#168](https://github.com/gabeklein/expressive-mvc/pull/168) [`037fbbe`](https://github.com/gabeklein/expressive-mvc/commit/037fbbe141ddfd12ebcaca3fcb55e6b285fe6bed) Rename the host-agnostic subpath `@expressive/react/runtime` to `@expressive/react/adapter`, and fix a circular import that crashed bundled apps.

  **Breaking (subpath rename).** The renderer-agnostic layer is now imported from `@expressive/react/adapter` (was `/runtime`). Update imports accordingly; `@expressive/preact` has been moved over.

  **Circular import fix.** Consuming the built package through a plain bundler (not Vite/src path-mapping) threw at module-eval time - `Cannot read properties of null` from the agnostic chunk - and the app never mounted. The runtime module re-exported `Consumer`/`Provider` from `context` while `context` imported the runtime primitives back, a value-level cycle the chunk-split build tripped on during initialization (live ESM bindings hid it in the monorepo).

  `runtime.ts` is now a pure leaf of host-agnostic primitives that imports nothing internal; the new `adapter.ts` barrel owns the adapter wiring (the `State.get` / `State.use` / component registrations) and re-exports the public surface. The dependency graph is one-way and acyclic.

  The `/adapter` surface is `Runtime`, `use`, `State`, `Consumer`, `Provider`. The internal StrictMode hooks (`useHook` / `useFactory` / `useReady`) are no longer re-exported there; they remain an implementation detail of the React adapter.

## 0.78.0

### Minor Changes

- [#161](https://github.com/gabeklein/expressive-mvc/pull/161) [`08b85ec`](https://github.com/gabeklein/expressive-mvc/commit/08b85ecfa0a16620f0851d8e2b2f79c805002050) **Re-architected as a pure adapter.** With `Component` now living in `@expressive/mvc`, `@expressive/react` is a thin host adapter rather than the home of the component model. It completes the core class through three channels - a `Component.on` lifecycle hook, prototype attach (`bootstrap`, `isReactComponent`, error boundary), and type augmentation. The public surface is unchanged: `Component` and the instructions are still re-exported from here.

  **Host-agnostic runtime subpath ([#117](https://github.com/gabeklein/expressive-mvc/issues/117)).** The renderer-agnostic adapter core is published at `@expressive/react/runtime` - the `Runtime` seam, StrictMode-safe hooks (`useHook`/`useFactory`/`useReady`), and standalone `use(subject)`. This is the same layer `@expressive/preact` builds on, bringing the two adapters to parity. The old `@expressive/react/state` subpath is renamed to `/runtime`.

  **Behavior.** `fallback={false}` now opts a `Component` out of its own Suspense boundary (Suspense-transparent) instead of being used as the fallback node ([#123](https://github.com/gabeklein/expressive-mvc/issues/123)). Props omitted on rerender are cleared to `undefined` ([#88](https://github.com/gabeklein/expressive-mvc/issues/88)); optional render props are preserved ([#86](https://github.com/gabeklein/expressive-mvc/issues/86)).

  **Breaking.** Import the agnostic runtime from `@expressive/react/runtime` (was `/state`). The `Observable` re-export is renamed to `Observer` ([#151](https://github.com/gabeklein/expressive-mvc/issues/151)).

- [#158](https://github.com/gabeklein/expressive-mvc/pull/158) [`742c685`](https://github.com/gabeklein/expressive-mvc/commit/742c68508320751b92a4ab3fc4dfa64b62e176a8) Exclude non-settable members from inferred JSX props.

  `Component.StateProps` now drops get-only accessors and `readonly` fields from the prop surface a component accepts. These members can never be meaningfully assigned from JSX, so offering them as props only invited no-op or type-erroring assignments. Writable fields, get/set accessors, callbacks, and methods are unaffected.

  The exclusion is the one structurally-detectable case (via a `readonly`-probe); TypeScript cannot distinguish a method from a callback field, so a blanket function exclusion is intentionally not attempted. The new behavior is consistent with `set`, which already rejects `readonly` keys.

### Patch Changes

- Updated dependencies [[`08b85ec`](https://github.com/gabeklein/expressive-mvc/commit/08b85ecfa0a16620f0851d8e2b2f79c805002050), [`92cc04c`](https://github.com/gabeklein/expressive-mvc/commit/92cc04c87441204dac809d304231839ae56f178d), [`742c685`](https://github.com/gabeklein/expressive-mvc/commit/742c68508320751b92a4ab3fc4dfa64b62e176a8)]:
  - @expressive/mvc@0.78.0
