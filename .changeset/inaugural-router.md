---
"@expressive/router": patch
---

**First release of `@expressive/router`** - a Component-based declarative router, the "C in MVC." Routes are plain `@expressive/mvc` Components authored against the agnostic JSX pragma, so they render under any host; `@expressive/react` is only a dev/test dependency (#130, #131, #150).

**Features.**
- **Declarative `<Route>` trees** - pages are plain Components; see-through scopes, `*` opaque delegation, and a `default` no-match branch. Sibling routes arbitrate first-match by declaration order, Express/switch-case style (#137).
- **Matching** - `:param` segments, trailing `*` catch-all, slash normalization, case-insensitive, scored.
- **`Router` / `BrowserRouter`** - a headless in-memory router (`goto`/`back`/`forward`/`replace`) and a browser binding over `window.location`/`history` with `popstate`, auto-spawned into the root context.
- **Reactive `query` + `url` (#138)** - the query string is a reactive record: reading `query.foo` subscribes, writing it navigates; a derived `url` getter is assignable to navigate.
- **`Link`** - `to`/`replace`, resolved hrefs, modifier-click bailout, and built-in active/match getters with subclass-replaceable render (#148). Plus `Redirect` (StrictMode-safe, `when`-gated) and `NavLinks`.
