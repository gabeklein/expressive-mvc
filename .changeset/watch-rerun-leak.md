---
'@expressive/mvc': patch
---

An effect or subscription (`state.get(fn)`, `State.use()` / `State.get()` in components, computed getters) no longer leaves its previous run's subscription attached when it re-runs. Listeners on the watched state - and on child states read through it - used to grow by one per re-run, so every write to a long-lived state slowed down steadily. A suspended run's subscription is released the same way once the effect runs again.
