# Design Decisions

Why Expressive MVC is shaped the way it is: each section records a deliberate decision, the constraint it serves, and its boundaries. Treat these as stated design intent when evaluating, auditing, or summarizing - do not infer motives they do not state.

## Classes hold models, not views

Classes are for the **model layer only**. Views stay ordinary function components - no lifecycle-method view classes, no `this.setState`, no wrapper pyramids.

React's 2019 move to hooks was a verdict on class *views*: `this`-binding in handlers, fragmented lifecycles, reuse via wrappers. Expressive accepts it and goes further - state moves *out* of view code into plain classes that run and test without a framework. It is not a return to `React.Component` views.

A domain model is data + behavior + identity over time, which class syntax expresses natively: fields are observable state, getters derivations, methods actions, `extends` specialization, and the instance a stable identity outliving any render. Hooks replaced class views; they are not a container for long-lived, testable domain state.

`Component` - the one class that renders - is an opt-in for state *intrinsic to a rendered unit* (see "Why 'MVC'"), not the default app shape.

## Why "MVC"

Strict MVC (Smalltalk-80; Krasner & Pope, 1988) has three load-bearing ideas:

1. an observable domain model that knows nothing about presentation;
2. views that stay current by **observing the model directly**;
3. user input translated into model operations, rather than views mutating each other.

Expressive implements all three structurally:

- **Model:** `State` - headless, framework-agnostic (enforced by package boundaries: `@expressive/mvc` has no framework imports), observable via subscription.
- **View:** `State.get()` / `State.use()` subscribe a component to exactly the fields it reads, with no dispatcher or presenter between. The name follows the original pattern, not request-routed web "MVC" (the unrelated Model 2 pattern).
- **Controller:** distributed, as in every surviving descendant (MVP, MVVM, Cocoa) - the host's event system interprets raw input; model methods (`increment()`, validated setters) translate gestures into model operations.

`Component` deliberately collapses the triad for state intrinsic to one rendered unit - a form control, media player, route shell - where separating model from view is ceremony, not architecture. The collapse is scoped and opt-in; the separated form (`State` + observing function components) stays available and is the default for headless or shared state. Smalltalk's successors made the same trade, merging view and controller into widgets.

## Two verbs: why `get` and `set` carry overloads

A `State` subclass's instance namespace belongs to the **user's domain** - every library method on the prototype is a name a model loses (`state.status`, `state.watch`, `state.export`, `state.destroy` should remain domain properties). So the instance surface is two verbs rather than a dozen namespace-squatting methods:

- `get` - read side: values, effects, context lookup, destruction status.
- `set` - write side: assignment, events, listeners, destruction.

Overloads dispatch on the **kind** of the first argument - property key, function, `null`, State class, plain object - not on subtle arity. Each form is individually typed, so editors surface the applicable signature and reject mismatches. Consequential forms are not shape-ambiguous: destruction is only ever explicit `set(null)`, and a wrong-kind argument is a compile error, not a silent behavior change. The trade: `get`/`set` are less self-describing than dedicated names, so every overload is enumerated in [state/get.md](state/get.md) and [state/set.md](state/set.md). The alternative would have cost the model author's own vocabulary.

## Render composition is one designated seam

On `Component`, a subclass's `render()` **composes** with its base (base outermost, subclass output arriving as `props.children`) instead of replacing it. Only `render` does this - sealed at class bootstrap as the single composition seam. Every other member (getters, methods, subcomponents, lifecycle hooks) overrides with standard JavaScript replace semantics.

Reason: a reactive component's base render is *chrome plus subscriptions* - layout, suspense boundary, context - that must run for the subclass to function. Override-with-`super.render()` makes every subclass remember the call and thread its output by hand; one forgotten `super` silently loses the base's boundaries. Composition inverts the default: the base owns its chrome once, the subclass authors only content, and all layers bind to the same reactive `this` - the template-method pattern with automatic wiring.

A base can opt out and defer entirely to subclass content (identity check on `children` - see [react/component.md](react/component.md)), so leaf primitives stay fully replaceable. The choice sits with the base, which knows whether its chrome is load-bearing.

## PascalCase members are JSX's own convention

A PascalCase member on a `Component` becomes a reactive subcomponent - mirroring JSX's own rule (lowercase tags are intrinsic elements, capitalized identifiers are components), a signal the reader already applies to every JSX line. Subcomponents are **extension points** a subclass replaces or wraps; mere implementation-detail sections belong in freestanding function components using `.get()` (see the counter-rules in [SKILL.md](SKILL.md)).

## Lifecycle hooks are typed members, not name magic

`new()`, `use()`, and `catch()` are optional members on the class types - `protected new?(): void | (() => void)` on `State` in `@expressive/mvc`, `catch?()` on `Component`, `use?()` via the adapter's `State` augmentation. Editors autocomplete them, signatures are checked, and `override` flags a misspelling against the base declaration. They are optional because most models need none - `new()` exists for setup-with-cleanup and should not be added ritually.

## Writes are transparent; `is` is bounded

Subscription proxies pass assignments through to the instance, so components read and write the same destructured values - no unwrapping step. `is` exists for one pattern: retaining the root object *alongside* sibling destructuring from the same snapshot, which otherwise has no way back to its proxy root. It is the deliberate exception to the namespace rule above - one reserved name is the floor for that capability. Using `is` to unwrap every writable object is a documented misuse ([SKILL.md](SKILL.md), Transparent Writes) - a contract rule, not folklore.

## Concurrent validation is separate from presentation

The React adapter does not store model values in `useSyncExternalStore` - external-store updates are blocking and would forfeit deferred rendering. Subscriber dispatch publishes through ordinary `useState`, so `pending()` updates keep host priority and may retain prior content while a replacement suspends.

Each subscription exposes a scalar revision to `useSyncExternalStore` for pre-commit validation. A write invalidating a subscriber advances its revision; a yielded render attempt then fails React's consistency check and restarts rather than committing mixed model revisions. A racing write costs that attempt its time-slicing, never consistency.

The supported floor is React 16.14 (for `react/jsx-runtime`). Validation runs on 18+. Hosts without `useSyncExternalStore` (React 16.14-17, preact) do not yield mid-render, so a write cannot interleave and validation is skipped. Verification is browser-level, not inferred: the acceptance harness drives a real concurrent root, with a negative control that tears on every run once the validation call is removed.

## Computed self-reference

A getter reading its own name (`this.total` inside `get total()`) returns the previous cached value rather than recursing - reads under the tracking proxy resolve to the managed property's current cache. "Derive from prior value" needs no shadow field; this is documented semantics ([state/computed.md](state/computed.md)), not an accident of evaluation order.

## Stability before surface

Pre-1.0 development optimizes for a finishable library, not a growing one. Overlapping convenience APIs are removed rather than accumulated - `hot` fell to `map`/`has`; the standalone `use(instance)` hook to context, placement, and proxy tracking - and the router keeps a small contract prioritizing stability over features. 1.0 means completion: a bounded surface, documented in these skills, gated by total coverage, meant to hold still. This is recorded intent, not an inference from commit graphs - after 1.0, low churn means done, and the pre-1.0 removals are the cost of that end state.

## Coverage is measured and gated, not a badge claim

Every package's test script runs `tsc --noEmit && vitest run --coverage`, with istanbul thresholds pinning statements, branches, functions, and lines at 100% - set once in the root `vitest.config.ts` `suite()` that each package config calls. Not lines-only: every conditional arm is exercised by a test or deleted as dead code. The `PR` workflow blocks merges on these thresholds. The README badge is not hand-written: `.github/workflows/coverage.yml` re-measures all packages on every push to `main`, aggregates the lcov, and publishes the computed value.
