# @expressive/router

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
