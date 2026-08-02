---
"@expressive/react": patch
---

Prevent concurrent React renders from committing mixed model revisions. Each subscription now exposes a revision counter to `useSyncExternalStore` for pre-commit validation only; presentation still publishes through ordinary React state, so `transition()` dispatch keeps deferred priority. React versions without `useSyncExternalStore` cannot yield mid-render and skip validation entirely.
