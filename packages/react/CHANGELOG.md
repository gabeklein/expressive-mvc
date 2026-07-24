# @expressive/react

## 0.82.0

### Minor Changes

- [#256](https://github.com/gabeklein/expressive-mvc/pull/256) [`f5f2773`](https://github.com/gabeklein/expressive-mvc/commit/f5f2773362209a4d5c18259ed31e7b106034b52c) Add `has()`, a field instruction for owned reactive collections. With no argument, a falsy value (`null`/`false`, for conditional init), or an iterable, it is an ordered list (`has.List<T>`): positional reads (`get(index)`, ranges, `get(predicate)`), `push`/`put`/`set(index)`/`pop`, with index-and-length precision tracking. With a `State` class or factory, it is a pool (`has.Pool<T, A>`): `add(...args)` spawns through the constructor or factory - forwarding arguments exactly as `Type.new()` accepts them - and returns the member, which is its own identity for `has`/`delete`/eviction. Ownership follows freshness: a fresh (never-activated) `State` member - constructed by a factory or instantiated from a class - is owned, and deleting, clearing, or destroying the owner destroys it, while an already-activated value (`Item.new()`) is a guest, held but never destroyed. Fresh members are parented to the hosting state and activate inside its context; a member that dies evicts itself. Both modes share `map(fn)`/`filter(fn)`/`any`/`all` and snapshot via `get()`. The runtime classes are exposed as `has.List` and `has.Pool` for adapter facades, and can be constructed without an owner for standalone use. Destruction is an eviction concern independent of the parent link.

  In `@expressive/react`, a collection renders directly - `<ul>{this.todos}</ul>` - through a `$$typeof` facade on those prototypes: the collection is one element whose members (each carrying their own identity) render in order, subscribing to collection shape without a manual spread or keys.

- [#240](https://github.com/gabeklein/expressive-mvc/pull/240) [`f003b03`](https://github.com/gabeklein/expressive-mvc/commit/f003b035b329ee8e8bbccab579badfb700b3c787) Add `map()`, a field instruction for shallow reactive maps - the field resolves at activation and the hosting state adopts the map in the same step. With no argument, a falsy value (`null`/`false`, for conditional init), or an iterable of entries, it is a plain keyed map (`map.Insert<K, V>`, extending native `Map`). With a factory function, it is a keyed spawning map (`map.Create<A, V>`, keyed by `A[0]`): `set(...args)` invokes the factory verbatim and stores the result at the first argument, replacing (and destroying, if owned) any previous value. Ownership follows freshness, uniformly across both modes: a fresh (never-activated) `State` value - handed to `set`, constructed by a factory, or present in initial entries - is adopted and destroyed on delete/clear/replace, while an already-activated value (`Item.new()`) is a guest, held but never destroyed. A map held by a `State` field adopts fresh members: parented to the owner, activated inside its context, and destroyed with it; the field is read-only, and a dead `State` value evicts itself from the map. Destruction is an eviction concern independent of the parent link, so the underlying `map.Managed` can be constructed without an owner (`new map.Managed()`) for standalone use. `get()` with no key returns a shallow `ReadonlyMap` snapshot; `keys(fn)` / `values(fn)` / `entries(fn)` return reusable transformed iterables. In `@expressive/react`, a map placed in JSX renders its values directly through a `$$typeof` facade on the `map.Managed` prototype - no manual spread - and treeshakes out when unused.

- [#247](https://github.com/gabeklein/expressive-mvc/pull/247) [`8e34b84`](https://github.com/gabeklein/expressive-mvc/commit/8e34b841177ff85a4aecf6c22c682426ee05ddf8) Give Component instances an overridable identity key and allow activated instances to render directly as React elements, including in arrays. Externally owned instances detach without being destroyed when unmounted.

### Patch Changes

- [#254](https://github.com/gabeklein/expressive-mvc/pull/254) [`1b1c7da`](https://github.com/gabeklein/expressive-mvc/commit/1b1c7da92da4948c5ceaed9f4b95119f215886c9) Fix `State.get()` failing to re-render a component when it reads a _nested_ reactive value - a child State's field, or a `map`/`has` entry - through the returned instance. The refresh was gated on the root instance's own change events, which are empty when only a nested value changes, so those updates were dropped (regressed by an earlier "optimized State.get" refactor that replaced a first-run flag with an `if (changed.length)` guard). It now refreshes on any observed change after the initial render, restoring the prior behavior. This lets a function component subscribe to a single nested value (e.g. one map entry) and repaint in isolation.

- [#250](https://github.com/gabeklein/expressive-mvc/pull/250) [`f0122c0`](https://github.com/gabeklein/expressive-mvc/commit/f0122c05cac8ddeb7825dd7f730cd42ce8271cf2) Fix instances rendered through a subscriber proxy (such as from their owner's own render) losing element identity on every re-render, causing React to remount their placement and context teardown to destroy the live instance. The element facade now installs on the real instance so all proxies share one identity, and context teardown only destroys instances the context itself constructed.

- Updated dependencies [[`1b1c7da`](https://github.com/gabeklein/expressive-mvc/commit/1b1c7da92da4948c5ceaed9f4b95119f215886c9), [`f5f2773`](https://github.com/gabeklein/expressive-mvc/commit/f5f2773362209a4d5c18259ed31e7b106034b52c), [`f003b03`](https://github.com/gabeklein/expressive-mvc/commit/f003b035b329ee8e8bbccab579badfb700b3c787), [`8e34b84`](https://github.com/gabeklein/expressive-mvc/commit/8e34b841177ff85a4aecf6c22c682426ee05ddf8), [`f0122c0`](https://github.com/gabeklein/expressive-mvc/commit/f0122c05cac8ddeb7825dd7f730cd42ce8271cf2)]:
  - @expressive/mvc@0.81.0

## 0.81.0

### Minor Changes

- [#196](https://github.com/gabeklein/expressive-mvc/pull/196) [`df90954`](https://github.com/gabeklein/expressive-mvc/commit/df90954199df6c06b4af3962bbd53fb8837c2d99) Move the low-level observable protocol (`observer`, `touch`, `event`, `listener`, `watch`, `Observer`) off the main entry to a dedicated `@expressive/mvc/observable` subpath. This declutters the primary import surface, which is now the app-facing API (`State`, `Component`, `Context`, instructions). The protocol is power-user surface for building custom observables; import it explicitly:

  ```ts
  import { watch, touch, event } from '@expressive/mvc/observable';
  ```

  Breaking: these names are no longer exported from `@expressive/mvc`, and `@expressive/react` no longer re-exports `Observer` from its main entry. Update imports to the subpath.

### Patch Changes

- Updated dependencies [[`de44e86`](https://github.com/gabeklein/expressive-mvc/commit/de44e86111c9eec6e5b0813174adfd34b15db158), [`df90954`](https://github.com/gabeklein/expressive-mvc/commit/df90954199df6c06b4af3962bbd53fb8837c2d99)]:
  - @expressive/mvc@0.80.0

## 0.80.0

### Minor Changes

- [#185](https://github.com/gabeklein/expressive-mvc/pull/185) [`fbd3f0c`](https://github.com/gabeklein/expressive-mvc/commit/fbd3f0c72e88da755bec7e58081947b67ee837e0) `set` now defines a reactive computed property when passed a function that takes an argument - the instruction equivalent of a class getter. `set(self => self.first + ' ' + self.last)` re-runs whenever a managed property it reads updates, receiving the instance as both `this` and its first argument. It is enumerable and read-only, matching a prototype getter.

  Dispatch is by arity: a zero-arg function (`set(() => ...)`) keeps its existing behavior as a one-shot lazy factory, while a function declaring a parameter routes into the reactive compute engine. This exposes getter behavior through an instruction, so it can be composed or wrapped, and - because the property is instruction-assigned rather than a concrete getter - a subclass may refine its type with `declare`, which a generic getter on a parent class cannot express.

### Patch Changes

- Updated dependencies [[`fbd3f0c`](https://github.com/gabeklein/expressive-mvc/commit/fbd3f0c72e88da755bec7e58081947b67ee837e0)]:
  - @expressive/mvc@0.79.0

## 0.79.1

### Patch Changes

- [#170](https://github.com/gabeklein/expressive-mvc/pull/170) [`7874353`](https://github.com/gabeklein/expressive-mvc/commit/78743532bf3012c1a59d60c5e5925c179815f98a) fix: preserve adapter side-effect modules in the published build

  `@expressive/react`'s `sideEffects` field listed only `jsx-runtime.ts`, so the
  bundler treated the other side-effect-only imports in `adapter.ts`
  (`state.get.ts`, `state.use.ts`, `component.ts`) as dead and dropped them from
  the emitted dist.

  The most visible casualty was `component.ts`, which installs the `context`
  property setter (`bootstrap`) on `Component.prototype`. When React instantiates
  an mvc Component as a class and assigns `this.context`, that setter is what
  activates state - resolving `set()` field instructions into reactive getters and
  swapping in the adapter's reactive render wrapper. Missing from dist, the
  assignment was a no-op: state never activated, `set()` fields stayed as raw
  `Symbol(field-…)` instructions, and React called `render` on the bare instance
  (e.g. `this.router.segment is not a function`). `State.get` / `State.use` were
  also silently absent from the published build.

  This only affected consumers of the published packages; the examples alias to
  `src`, where the imports always execute. Adding the three modules to
  `sideEffects` keeps them in the build.

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
