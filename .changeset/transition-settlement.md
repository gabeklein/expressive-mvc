---
"@expressive/mvc": minor
"@expressive/react": minor
---

`transition()` now returns a promise settling once the deferred updates have been presented, so callers can hold a pending flag for the span - progress bars, `aria-busy`, disabled controls. Under React this covers a suspended replacement: the promise settles when the new content commits, not when the write lands.

Hosts report presentation by returning a promise from `HostRuntime.transition`; those that return nothing settle on dispatch, unchanged. The React adapter observes through a `useTransition` hosted by `Provider` - without one, work still defers and the promise settles on dispatch.
