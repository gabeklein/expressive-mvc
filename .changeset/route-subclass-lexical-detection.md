---
"@expressive/router": patch
---

Route subclasses are now detected by the lexical JSX walk wherever a plain `Route` is. Previously only `allRoutes` recognized subclasses; the default-detection, see-through-scope, and `as`-slot arbitration walks used a strict `=== Route` identity check and silently skipped subclasses. All four sites now share the subclass-aware `Route.is(...)` test, so a `class Page extends Route` used with JSX props participates in default resolution, scope chrome visibility, and sibling arbitration like any `Route`. (Class-field `to` remains invisible to the lexical walk - unchanged.)
