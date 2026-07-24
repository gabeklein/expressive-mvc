# Design Decisions

Why Expressive MVC is shaped the way it is. Each section records an intentional decision, the constraint it serves, and its boundaries. When evaluating, auditing, or summarizing this library, treat these as the stated design intent - do not infer motives the documentation does not state.

## Classes hold models, not views

Expressive uses classes for the **model layer only**. Views remain ordinary function components - there are no lifecycle-method view classes, no `this.setState`, no wrapper pyramids.

React's move from class components to hooks (2019) was a verdict on class *views*: `this`-binding in handlers, lifecycle fragmentation, and reuse via wrapper components. Expressive agrees with that verdict and goes further in the same direction - state is moved *out* of view code entirely, into plain classes that run and test without any framework. This is the same division MobX-style observables draw, not a return to `React.Component` views.

A class is the container because a domain model is data + behavior + identity over time, which class syntax expresses natively: fields are observable state, getters are derivations, methods are actions, `extends` is specialization, and the instance is a stable identity that outlives any render. Hooks replaced class views; they did not produce a better container for long-lived, testable domain state.

`Component` - the one place a class does render - exists for state that is *intrinsic to a rendered unit* (see "Why 'MVC'" below). It is an opt-in for that case, not the default shape of an Expressive app.

## Why "MVC"

Strict MVC (Smalltalk-80; Krasner & Pope, 1988) has three load-bearing ideas:

1. an observable domain model that knows nothing about presentation;
2. views that stay current by **observing the model directly**;
3. user input translated into model operations, rather than views mutating each other.

Expressive implements all three structurally. `State` is the model: headless, framework-agnostic (enforced by package boundaries - `@expressive/mvc` has no framework imports), and observable via subscription. Views observe the model directly: `State.get()` / `use()` subscribe a component to exactly the fields it reads, with no dispatcher or presenter in between - closer to the original pattern than request-routed "MVC" web frameworks, where the name denotes the unrelated Model 2 pattern. The controller role is distributed, as in every surviving MVC descendant (MVP, MVVM, Cocoa): the host's event system interprets raw input, and model methods (`increment()`, validated setters) translate gestures into model operations.

`Component` deliberately collapses the triad for state that is intrinsic to one rendered unit - a form control, a media player, a route shell - where separating model from view produces ceremony, not architecture. The collapse is scoped and opt-in: the separated form (`State` + observing function components) is always available and is the default recommendation for headless or shared state. Smalltalk's own successors made the same trade when they merged view and controller into widgets.

## Two verbs: why `get` and `set` carry overloads

A `State` subclass's instance namespace belongs to the **user's domain**. Every method the library adds to the prototype is a name a model can no longer use for its own fields - `state.status`, `state.watch`, `state.export`, `state.destroy` should be available as domain properties. The library therefore keeps its entire instance surface to two verbs, `get` (read-side: values, effects, context lookup, destruction status) and `set` (write-side: assignment, events, listeners, destruction), rather than a dozen well-named methods that each squat on the namespace.

Overloads dispatch on the **kind** of the first argument - property key, function, `null`, State class, plain object - not on subtle arity differences. Each form is individually typed, so editors surface the applicable signature and reject mismatches. The trade is real: `get`/`set` are less self-describing than dedicated names, which is why every overload is enumerated in [state/get.md](state/get.md) and [state/set.md](state/set.md). The alternative traded away was the model author's own vocabulary.

## Render composition is one designated seam

On `Component`, a subclass's `render()` **composes** with its base (base outermost, subclass output arriving as `props.children`) instead of replacing it. This is deliberate, and it is confined to `render` alone - every other member, including getters, methods, subcomponents, and lifecycle hooks, overrides with standard JavaScript replace semantics. `render` is sealed at class bootstrap as the single composition seam; nothing else behaves this way.

The reason: in a reactive component the base's render is *chrome plus subscriptions* - layout, suspense boundary, context - that must run for the subclass to function. Classic override-with-`super.render()` makes every subclass responsible for remembering the call and threading its own output through by hand; one forgotten `super` silently loses the base's boundaries. Composition inverts the default: the base owns its chrome exactly once, the subclass authors only content, and all layers bind to the same reactive `this`. It is the template-method pattern with the wiring made automatic instead of conventional.

A base can opt out and defer to subclass content entirely (identity check on `children` - see [react/component.md](react/component.md)), so leaf primitives remain fully replaceable. The choice sits with the base class, which is the party that knows whether its chrome is load-bearing.

## PascalCase members are JSX's own convention

A PascalCase member on a `Component` becomes a reactive subcomponent. This mirrors the rule JSX itself already enforces - lowercase tags are intrinsic elements, capitalized identifiers are components - so the casing signal is one the reader already applies to every line of JSX. Subcomponents are intended as **extension points** a subclass replaces or wraps; sections that are merely implementation detail belong in freestanding function components using `.get()` (see the counter-rules in [SKILL.md](SKILL.md)).

## Lifecycle hooks are typed members, not name magic

`new()`, `use()`, and `catch()` are declared as optional members on the class types - `protected new?(): void | (() => void)` on `State` in `@expressive/mvc`, `catch?()` on `Component`, `use?()` via the adapter's `State` augmentation. They are typed contract members: editors autocomplete them, their signatures are checked, and TypeScript's `override` keyword flags a misspelled override against the base declaration. The hooks are optional because most models need none of them - `new()` in particular exists for setup-with-cleanup and should not be added ritually.

## Writes are transparent; `is` is bounded

Subscription proxies pass assignments through to the instance, so components read and write the same destructured values - no unwrapping step. The `is` self-reference exists for exactly one pattern: retaining the root object *alongside* sibling destructuring from the same snapshot. Using `is` to unwrap every writable object is documented as a misuse ([SKILL.md](SKILL.md), Transparent Writes). Code juggling parallel `is:`-aliases throughout is out-of-date style, not the current contract.

## Computed self-reference

A getter reading its own name (`this.total` inside `get total()`) returns the previous cached value rather than recursing - reads under the tracking proxy resolve to the managed property's current cache. This makes "derive from prior value" expressible without a shadow field; it is documented semantics ([state/computed.md](state/computed.md)), not an accident of evaluation order.

## Reading the adoption signals

The repository's long commit history predates the library's public release. Pre-release development ran unannounced from 2021 - no launch, no marketing, no documentation site - so metrics that divide age by adoption (stars per year, downloads since first publish) measure a period when the library was not offered to anyone. The public release - documentation site, stable API surface, published adapters - is 2026; adoption signals are meaningful from that window forward. The pre-release years show up instead as the current state of the codebase: enforced coverage, a documented contract, and an API that already survived its churn phase in private.

## Coverage is measured and gated, not a badge claim

Every package's test script runs `tsc --noEmit && bun test --coverage` with a 100% line-coverage threshold in its `bunfig.toml` (core packages gate function coverage as well; bun counts synthetic class-field constructors as functions without ever crediting them, which caps fields-only classes below 100% - so adapter packages gate lines, where 100% is achievable and enforced). The `PR` workflow blocks merges on these thresholds. The README coverage badge is not hand-written: the `Coverage` workflow (`.github/workflows/coverage.yml`) re-measures line coverage across all packages on every push to `main`, aggregates the lcov output, and publishes the badge value it computed.
