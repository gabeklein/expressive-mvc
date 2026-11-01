---
"@expressive/dom": minor
---

Style maps take conditions: a `:state` or `@media …` key holds a map applied while it holds - at the top of a map, inside a rule, or nested. `:` keys split on commas into alternatives; `_rule` inside an `@` condition applies that rule under it. Condition blocks sort after the block they modify and add no specificity, so doors still win. Adds `media({ maxWidth: 900 })` and the `style.Condition` type.
