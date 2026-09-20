---
"@expressive/router": patch
---

Relative route navigation now preserves its query string. `Route.resolve`,
`Route.goto`, and `Link` no longer turn a target such as
`./edit?tab=history` into `/edit`.
