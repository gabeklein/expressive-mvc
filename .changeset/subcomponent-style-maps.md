---
'@expressive/dom': minor
---

`style()` maps address subcomponents by key. `_Title: { ... }` is the `Title` subcomponent's own map - base declarations for its roots, rules and tag matches for its output - resolved through the owner's class wherever it renders and composed through the class chain. Top-level rules still style `render()` output only. `_` plus a capital letter is reserved for this and throws when nested in a rule or written as an attribute on an element.
