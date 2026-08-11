---
"@expressive/mvc": minor
"@expressive/react": minor
---

Deferred presentation arrives as `State.act(work)`, replacing the free `transition()` export (removed).

Work marked this way is non-urgent, so React keeps current content on screen while a replacement gets ready rather than falling back. The returned promise settles once every subscriber the work touched has **absorbed** it - under React, once the update commits - so a caller can hold a pending flag across the wait. Writes inside are ordinary and may target any state, owned or not.

Settlement is reported by the subscribers themselves rather than by the host, so `act` needs no render of its own: any State can start one, from anywhere. A subscriber which cannot report - unmounted, or a host which does not defer - settles on replay.

Note that mvc writes are immediate and only notification defers, so a subscriber which reads a pending flag must not rebuild the deferred content on the same pass - read it from a sibling, or from a wrapper taking that content as `children`.

Migrating: `transition(() => …)` becomes `state.act(() => …)`. `HostRuntime.transition` is now a plain bracket returning nothing; hosts no longer report presentation through it.
