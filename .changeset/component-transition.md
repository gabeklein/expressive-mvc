---
"@expressive/mvc": minor
"@expressive/react": minor
---

Deferred presentation moves to `Component.transition(work)`, replacing the free `transition()` export (removed).

Work marked this way is non-urgent, so React keeps current content on screen while a replacement gets ready rather than falling back. The returned promise settles once that work is **presented** - after a suspended replacement commits - so a caller can hold a pending flag across the wait. Writes inside are ordinary and may target any state, owned or not.

`Component` is the only host that can report progress: React tracks a transition through the hook that started it, so observing one requires a render to schedule through. The adapter installs that hook in a wrapper around the content of components which declare their own `transition` - it re-renders when pending changes, and doing that to the component itself would rebuild the content and defeat the deferral. Classes inheriting `transition` pay nothing and still defer; their promise settles on dispatch, as it also does before mount or on a host without `useTransition`.

Migrating: `transition(() => …)` becomes `component.transition(() => …)`. Hosts report presentation by returning a promise from `HostRuntime.transition`; returning nothing behaves as before.
