---
"@expressive/router": minor
---

Add a `protected routes()` extension point to `Route`. Subclasses override it to opine on the child routes of their own scope - add, remove, or reorder - returning JSX nodes that flow through every registration-form behavior (`inner`, `active`, `matches`, default gating) and the see-through gate for that scope. The default implementation passes children through unchanged, so plain `Route` behavior is unaffected. Because `routes()` is pure analysis (it returns nodes and never triggers a page render), `matched` can consult it without breaking the lazy render gate. A subclass that contributes routes can flip its own leaf<->see-through classification, reflecting its effective children.
