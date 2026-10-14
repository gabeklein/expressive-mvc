---
'@expressive/mvc': minor
'@expressive/react': minor
'@expressive/dom': minor
'@expressive/router': patch
---

Render composition is removed. A subclass `render()` now replaces its base's like any method override, on `Component` and on a rendered `State`, in every host. To keep a base's chrome around subclass content, render a subcomponent the subclass overrides (`<this.Body />`), or call `super.render(props)` from the override to wrap the base. `compose` is no longer exported from `@expressive/mvc/jsx-runtime`.

Migration: a subclass `render()` that relied on being wrapped by its base's render moves to a subcomponent the base renders; a base that read the subclass output from `props.children` renders that subcomponent instead.

`Route` keeps its behavior: a subclass `render()` is still the route's page, gated on match, guards and redirects, and run only when matched. `super.render()` inside it places the default content (`as` around `children`). A `Link` subclass `render()` still replaces the anchor.
