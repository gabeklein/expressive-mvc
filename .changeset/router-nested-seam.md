---
"@expressive/router": minor
---

Add a `protected get nested` extension point to `Route`. It defaults to the children declared in JSX; a subclass overrides the getter to opine on the child routes of its own scope - add, remove, or reorder - composing on `super.nested`. The result flows through every registration-form behavior (`inner`, `active`, `matches`, default gating) and the see-through gate for that scope, so contributed routes participate in matching and render as if declared. Because `nested` is pure analysis (it returns nodes and never triggers a page render), `matched` can consult it without breaking the lazy render gate. A subclass that contributes routes can flip its own leaf<->see-through classification, reflecting its effective children.
