# @expressive/router

## 0.4.0

### Minor Changes

- [#181](https://github.com/gabeklein/expressive-mvc/pull/181) [`c25bb84`](https://github.com/gabeklein/expressive-mvc/commit/c25bb84b448aa859c15173e913bf73a9ee91ed68) A functional `redirect` guard returning `null` now **force-404s**: the route cedes its match for the current path and the scope falls through to its nearest `default`. This lets a page (or its data loader) decline a path it structurally matched - e.g. a fetch returning 401/404 - without revealing whether the resource is forbidden or absent. The decision is path-keyed (it marks only the concrete URL declined, cleared on navigation) and rides reactive `Router` state, so the section's `default` re-arbitrates without an error boundary. `null` is distinct from a falsy verdict (`''`/`undefined`), which still allows normal render. A force-404'd leaf is also excluded from `Route.active`.

- [#186](https://github.com/gabeklein/expressive-mvc/pull/186) [`f89008d`](https://github.com/gabeklein/expressive-mvc/commit/f89008d2abd06744d39c3a840a30372a545ef6a9) `Route.goto` now accepts a params object to swap route params in place: `route.goto({ id: '456' })` rebuilds the route's path from its current match merged with the given overrides (`/document/123` -> `/document/456`). Any param the route declares works, not just the last (`goto({ b: '8' })` on `/a/:b/:c`). A route can only set the params it declares in its own `to`: inherited (ancestor) segments are filled read-only, and a key the route doesn't own throws (so in `<Route to="org/:orgId"><Route to="user/:userId"/></Route>` the inner leaf can swap `userId` but not `orgId`). A declared param the current path can't supply throws the usual unresolved-parameters error. This replaces the `goto("../" + id)` idiom for sibling-param navigation. String `goto` (relative/absolute paths) is unchanged.

- [#181](https://github.com/gabeklein/expressive-mvc/pull/181) [`c25bb84`](https://github.com/gabeklein/expressive-mvc/commit/c25bb84b448aa859c15173e913bf73a9ee91ed68) `Route`'s `redirect` now accepts a function, optionally async, in addition to a static string - an entry guard for auth gates and the like. It is evaluated on entry to the route's scope (the current path falling within its subtree): a truthy string redirects there, a falsy result (`''`/`undefined`) allows normal render, and a returned `Promise` shows the route's `fallback` until it settles. The verdict is cached for navigations within the space and re-evaluated on re-entry. A static-string `redirect` behaves exactly as before; a function guard now participates in sibling matching until it actually redirects, so it can wrap a section (a `Route` with children) and gate the whole subtree.

### Patch Changes

- [#181](https://github.com/gabeklein/expressive-mvc/pull/181) [`c25bb84`](https://github.com/gabeklein/expressive-mvc/commit/c25bb84b448aa859c15173e913bf73a9ee91ed68) A functional `redirect` guard now runs on a route whose own pattern contains a `:param` (e.g. `to="document/:id"`). The in-space check compared the literal, unsubstituted pattern against the URL, so any such route silently skipped its guard; it now gates on `matched`, which resolves captures.

- Updated dependencies [[`fbd3f0c`](https://github.com/gabeklein/expressive-mvc/commit/fbd3f0c72e88da755bec7e58081947b67ee837e0)]:
  - @expressive/mvc@0.79.0

## 0.3.0

### Minor Changes

- [#177](https://github.com/gabeklein/expressive-mvc/pull/177) [`5777fb6`](https://github.com/gabeklein/expressive-mvc/commit/5777fb62c2744764bc0430ebb410d8b08321bb71) Widen `Route`'s `as` to accept any function or class element type, including a fellow `Route` subclass, instead of only a `(props) => Node` function. The type is mvc's agnostic `Exclude<JSX.ElementType, string>`, so a `Route`/component class type-checks as `as` while intrinsic host tags stay excluded. This enables `<Route as={SomeRouteClass} />` - e.g. a generated wrapper delegating to a user page class - without a cast. When `as` is itself a `Route`, delegation falls out of the existing see-through machinery: the inner Route is the sole arbiter, receives the outer's computed `nested` as its children, and `Route.get` inside its content resolves the inner instance.

## 0.2.0

### Minor Changes

- [#176](https://github.com/gabeklein/expressive-mvc/pull/176) [`6aa0719`](https://github.com/gabeklein/expressive-mvc/commit/6aa0719d25ca260c6ad2fb1b9a02fb248b161dd9) `Route.goto()` now resolves its argument relative to the Route it is called on, and with no argument navigates to that Route itself (its concrete, params-filled path) - enabling "pop from below", where a subroute reaches a named ancestor via context and navigates up to it as currently identified. `goto` always resolves relative to its receiver and an absent argument means `"."` (here), so `''`/`'.'` are no longer dead no-ops. This also fixes `anchor` for nested Routes: it now recovers params from the live path and composes `base` correctly, so relative navigation works from any depth.

- [#175](https://github.com/gabeklein/expressive-mvc/pull/175) [`fc3f416`](https://github.com/gabeklein/expressive-mvc/commit/fc3f416b1f4444b7be7b7f0d4cad89662e8205a7) Add a `protected get nested` extension point to `Route`. It defaults to the children declared in JSX; a subclass overrides the getter to opine on the child routes of its own scope - add, remove, or reorder - composing on `super.nested`. The result flows through every registration-form behavior (`inner`, `active`, `matches`, default gating) and the see-through gate for that scope, so contributed routes participate in matching and render as if declared. Because `nested` is pure analysis (it returns nodes and never triggers a page render), `matched` can consult it without breaking the lazy render gate. A subclass that contributes routes can flip its own leaf<->see-through classification, reflecting its effective children.

### Patch Changes

- [#173](https://github.com/gabeklein/expressive-mvc/pull/173) [`9e4009f`](https://github.com/gabeklein/expressive-mvc/commit/9e4009f85258522fa433f3d3aaf9134aeca78391) Route subclasses are now detected by the lexical JSX walk wherever a plain `Route` is. Previously only `allRoutes` recognized subclasses; the default-detection, see-through-scope, and `as`-slot arbitration walks used a strict `=== Route` identity check and silently skipped subclasses. All four sites now share the subclass-aware `Route.is(...)` test, so a `class Page extends Route` used with JSX props participates in default resolution, scope chrome visibility, and sibling arbitration like any `Route`. (Class-field `to` remains invisible to the lexical walk - unchanged.)

## 0.1.0

### Minor Changes

- [#166](https://github.com/gabeklein/expressive-mvc/pull/166) [`62d242b`](https://github.com/gabeklein/expressive-mvc/commit/62d242bf65382edb233db7748f00f7463e1c9606) fix: keep overridden `render` valid as JSX when consuming built packages

  When `@expressive/router` was consumed as a built package (outside the monorepo), `<Route>`, `<Link>`, and `<NavLinks>` failed type-checking as JSX (`TS2786`). Their `render` overrides had no explicit return type, so the `.d.ts` emitter baked the host-seam alias's build-time fallback (`unknown`) into the published types, which is not assignable to `ReactNode`.

  Two changes fix this:
  - `@expressive/router`: the overridden `render` methods are annotated `: Component.Node`, so the emitter preserves the deferred alias by reference and it re-resolves to the host node type (e.g. `ReactNode`) in a consumer.
  - `@expressive/mvc`: `Component.Node` now falls back to `any` instead of `unknown`. `any` is the only fallback assignable to every host's node type, so an un-annotated `render` override in any host-agnostic package still emits a JSX-valid return.

### Patch Changes

- Updated dependencies [[`62d242b`](https://github.com/gabeklein/expressive-mvc/commit/62d242bf65382edb233db7748f00f7463e1c9606)]:
  - @expressive/mvc@0.78.1

## 0.0.1

### Patch Changes

- [#161](https://github.com/gabeklein/expressive-mvc/pull/161) [`08b85ec`](https://github.com/gabeklein/expressive-mvc/commit/08b85ecfa0a16620f0851d8e2b2f79c805002050) **First release of `@expressive/router`** - a Component-based declarative router, the "C in MVC." Routes are plain `@expressive/mvc` Components authored against the agnostic JSX pragma, so they render under any host; `@expressive/react` is only a dev/test dependency ([#130](https://github.com/gabeklein/expressive-mvc/issues/130), [#131](https://github.com/gabeklein/expressive-mvc/issues/131), [#150](https://github.com/gabeklein/expressive-mvc/issues/150)).

  **Features.**
  - **Declarative `<Route>` trees** - pages are plain Components; see-through scopes, `*` opaque delegation, and a `default` no-match branch. Sibling routes arbitrate first-match by declaration order, Express/switch-case style ([#137](https://github.com/gabeklein/expressive-mvc/issues/137)).
  - **Matching** - `:param` segments, trailing `*` catch-all, slash normalization, case-insensitive, scored.
  - **`Router` / `BrowserRouter`** - a headless in-memory router (`goto`/`back`/`forward`/`replace`) and a browser binding over `window.location`/`history` with `popstate`, auto-spawned into the root context.
  - **Reactive `query` + `url` ([#138](https://github.com/gabeklein/expressive-mvc/issues/138))** - the query string is a reactive record: reading `query.foo` subscribes, writing it navigates; a derived `url` getter is assignable to navigate.
  - **`Link`** - `to`/`replace`, resolved hrefs, modifier-click bailout, and built-in active/match getters with subclass-replaceable render ([#148](https://github.com/gabeklein/expressive-mvc/issues/148)). Plus `Redirect` (StrictMode-safe, `when`-gated) and `NavLinks`.

- Updated dependencies [[`08b85ec`](https://github.com/gabeklein/expressive-mvc/commit/08b85ecfa0a16620f0851d8e2b2f79c805002050), [`92cc04c`](https://github.com/gabeklein/expressive-mvc/commit/92cc04c87441204dac809d304231839ae56f178d), [`742c685`](https://github.com/gabeklein/expressive-mvc/commit/742c68508320751b92a4ab3fc4dfa64b62e176a8)]:
  - @expressive/mvc@0.78.0
