---
"@expressive/router": minor
---

`Route.goto()` now resolves its argument relative to the Route it is called on, and with no argument navigates to that Route itself (its concrete, params-filled path) - enabling "pop from below", where a subroute reaches a named ancestor via context and navigates up to it as currently identified. `goto` always resolves relative to its receiver and an absent argument means `"."` (here), so `''`/`'.'` are no longer dead no-ops. This also fixes `anchor` for nested Routes: it now recovers params from the live path and composes `base` correctly, so relative navigation works from any depth.
