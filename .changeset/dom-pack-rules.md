---
"@expressive/dom": minor
---

`App.use(...maps)` takes pack rules - element defaults, roles and condition blocks applied to elements written by every component that `style` styles, below each component's own declarations and rules. Each call with maps is its own scope; `use()` without maps stays shared per class. `style(X)` with no map joins the pack, and subcomponents without a map receive its rules. The conflict error now reads `is already styled by another pack`.
