---
"@expressive/react": patch
---

Fix `State.get()` failing to re-render a component when it reads a *nested* reactive value - a child State's field, or a `map`/`has` entry - through the returned instance. The refresh was gated on the root instance's own change events, which are empty when only a nested value changes, so those updates were dropped (regressed by an earlier "optimized State.get" refactor that replaced a first-run flag with an `if (changed.length)` guard). It now refreshes on any observed change after the initial render, restoring the prior behavior. This lets a function component subscribe to a single nested value (e.g. one map entry) and repaint in isolation.
