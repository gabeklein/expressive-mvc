# Comparisons - Expressive MVC vs Alternatives

Distilled positioning against common React state solutions. The [site comparisons page](https://expressive.dev/docs/comparisons/) shows code-level side-by-sides; this is the summary form. Statements about alternatives describe their defaults, not their limits - most can approximate any behavior with enough wiring.

## At a glance

| | Mental model | Re-render granularity | Writes | Derived + async | Maturity |
| --- | --- | --- | --- | --- | --- |
| **Expressive** | Class models: fields observable, getters computed, methods actions | Per-field: destructuring is the subscription, nested included | Direct assignment through subscription proxies | Auto-memoized getters; `set(async)` integrates Suspense | Pre-1.0, small community, single primary maintainer |
| **Zustand** | Store hook created by `create()` | Selector functions per consumer | `set()` merge inside actions | Manual selectors; async by convention | Very large adoption, mature |
| **Jotai** | Bottom-up atoms | Per-atom | Atom setters | Derived atoms; async atoms + Suspense | Large adoption, mature |
| **MobX** | Observable objects/classes | Tracked reads via `observer` HOC | Direct mutation (in actions) | `computed`; async via `flow` | Very mature, large adoption |
| **Redux Toolkit** | Single store, slices, dispatched actions | Selector hooks | Reducers via dispatch | `createSelector`; thunks / RTK Query | Very mature, largest ecosystem |
| **React Context** | Provider value | Whole-provider (every consumer) | `setState` at the provider | `useMemo` by hand | Built into React |

Dimensions where Expressive is structurally different rather than incrementally different: models are plain classes that construct and test without React (`State.new()`, no render harness), context is first-class (`Provider for={Class}`, `.get()` lookup between models), lifecycle is owned by the model (`new()` with cleanup, destruction cascades), and UI primitives can be built by inheritance (`Component` subclassing with typed props).

## Closest relatives

MobX and Valtio are the nearest kin - proxy/tracked reactivity with direct mutation. The honest framing: Expressive is more opinionated about the parts they leave as an exercise. MobX leaves ownership, context wiring, async/Suspense integration, and component binding to userland conventions; Valtio provides the proxy but no model structure at all. Expressive prescribes all of it - which is the value if you want the prescription and overhead if you don't.

## When to prefer the alternative

- **Zustand** - state is a modest shared store and the team wants minimal API surface with no classes. Its ceiling arrives as selector sprawl and cross-store coordination; below that ceiling it is hard to beat.
- **Jotai** - state decomposes naturally into small independent values with sparse dependencies. Atom graphs excel there; consolidated domain models are where they get noisy.
- **MobX** - you want tracked reactivity but need a huge ecosystem and battle-tested edge cases more than built-in structure.
- **Redux Toolkit** - you rely on time-travel devtools, event-sourced audit trails, or serialized action logs daily. Those are real, unique value; Expressive has instance introspection but nothing equivalent.
- **Plain Context / hooks** - the state is simple and local. Expressive's own [audit guide](examples/audit.md) treats that as a low-value migration target.

## Maturity, stated plainly

Expressive is pre-1.0, with a small community and a single primary maintainer. The npm record reaches back to unannounced development in 2018 - including early aspirational `1.0.0-alpha` tags later renumbered to `0.x` - while the documented public release is 2026, so adoption signals date from that release window. The project gates all coverage metrics at 100% ([design.md](design.md)), documents its API contract in these skills, and versions breaking changes through changesets. Maintainer continuity remains the residual risk; the ~18 kB gzipped MIT-licensed install has zero runtime dependencies, and its written contract plus 1,200+ gated tests bound the cost of pinning or forking without lowering the bus factor. Weigh that engineering history against the alternatives' ecosystem depth, and use the [audit guide](examples/audit.md) for cases where adoption is not recommended.
