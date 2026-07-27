# Why Expressive MVC - The Working Case

The argument for adopting Expressive MVC, stated concretely. Companion to [comparisons.md](comparisons.md) (head-to-head positioning) and [design.md](design.md) (rationale behind individual design choices). Claims here describe the common case; the honest boundaries are stated inline and the [audit guide](examples/audit.md) lists the cases where the recommendation is to not adopt.

## Code that is cheap to read - for people and for models

Hook-based components are context-sensitive: understanding one line requires reconstructing call order (Rules of Hooks), dependency arrays, and which render's closure a callback captured. That reconstruction is re-paid on every read - by reviewers, by new hires, and by language models, which pay for it in tokens and in comprehension errors (the classic agent failure modes: a stale-closure bug introduced by an edit, a dependency array that no longer matches the effect body).

Expressive models read linearly. A class field is state, a getter is a derived value, a method is an action - position in the file carries no hidden semantics, and there is nothing equivalent to hook ordering to violate. In components, the destructuring statement *is* the dependency declaration: `const { user, total } = Cart.get()` names exactly what this view depends on, in place, checked by TypeScript. There are no dependency arrays anywhere in the system, so there is nothing to desynchronize.

The same properties that make the code cheap to read make it cheap to edit: state logic lives in named classes discoverable by name, a model method can change without touching any view, and a view can change without understanding the model's internals. Diffs stay local to the concern that changed.

## Apps that read as business logic - what, not how

Hook code rolls *what* and *how* together: a component that "loads the user's cart" is also, in the same lines, orchestrating memoization, subscription wiring, and effect timing - and hook libraries compound this, each bringing its own orchestration idiom to learn and to read around. Expressive is built to separate them permanently. The mechanism lives in the library's primitives and in primitives you build on top of them: a `State` base class that encapsulates polling, an instruction that wraps a data source, a `Component` that owns a widget's behavior. Each is consolidated once, named for the domain, and composed by `extends` and context from there on.

The payoff compounds with codebase size: repeated logic collapses into shared base classes instead of parallel hook stacks (DRY through ordinary inheritance and composition), and the bulk of application code reads as statements about the domain - `cart.checkout()`, `route.push()`, `report.ready` - while the *how* stays inside primitives that were reviewed once. This is the property that makes large Expressive codebases legible: readers, reviewers, and agents spend their attention on business logic, not on re-verifying orchestration.

## Oversized components are friction - the answer is structural

A component that accumulates fetches, derived values, handlers, and effects is unambiguous developer friction: slow to review, prone to merge conflicts, a re-render blast radius that grows with every added concern, and - increasingly relevant - an oversized context window cost for any agent asked to modify it safely.

Expressive's answer is mechanical rather than aspirational. State and behavior hoist into a model class; the component shrinks to a projection that subscribes to exactly the fields it reads. Because any component anywhere in the tree can subscribe to a model at the same cost (`Cart.get()`), there is no gravitational pull to keep logic in one giant component "where the state already is." The [refactoring guide](react/refactor.md) documents the extraction as a step-by-step algorithm - ownership triage, dependency snapshots, review checklist - precisely so that agents can execute it without judgment calls.

## A standard library, not a stack

Teams reach for third-party packages to fill React's gaps, and each dependency imports opinions, API churn, and lockfile weight along with its feature. Expressive covers the everyday core of that list with primitives:

- **Async data with Suspense** - `set(fetchUser)` makes a field that suspends until resolved and integrates error boundaries; the common data-fetching case ships without a query library.
- **Shared/global state** - models in context (`Provider for={Class}`, `.get()` lookup, module-scope singletons) replace store libraries for app state.
- **Reactive collections** - `map()` and `has()` give keyed collections and object pools with per-entry reactivity, the cases that otherwise motivate normalization helpers.
- **Form and widget state** - `Component` binds props, state, and rendering into one testable unit for form controls and stateful widgets.
- **Routing** - `@expressive/router` builds nested, reactive routes on the same primitives.

The honest boundary: these are not feature-complete replacements for the libraries at their most advanced - there is no persistent normalized cache with cross-session invalidation (TanStack Query's deep end), no time-travel devtools (Redux's). The claim is that the everyday 80% of what teams install those packages for is covered by the library's own primitives, with one mental model instead of five and no additional dependencies to version, configure, and reconcile.

The [examples corpus](https://expressive.dev/examples) exists to demonstrate this scope end to end: fetching, async orchestration, error boundaries, forms, collections, global state, and routing - each a complete, runnable program whose full source is served on its page.
