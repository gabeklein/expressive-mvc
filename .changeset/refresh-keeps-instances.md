---
"@expressive/react": patch
---

Fast Refresh no longer breaks state in an edited component. Refresh re-runs a component's effects after re-rendering it, which destroyed the instance from `State.use()` and dropped `.get()` subscriptions - the component kept rendering a dead instance and stopped updating. A cleanup that follows an uncommitted render now waits a microtask and is dropped when the effect runs again; unmounting still cleans up synchronously.
