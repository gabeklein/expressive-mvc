---
'@expressive/inspect': minor
---

`act()` and the bridge's `around()` settle once a macrotask passes with no new recorded frame, instead of after a single `setTimeout(0)` - work deferred through timer or promise chains now lands in the returned frames. Both take `{ timeout }` (default one second) and warn when it passes first; the Vite relay's `around` answers `settled: false` instead.

Add `journal.summary(query?)` - a per-instance digest of recorded frames (keys written with counts and last values, calls, destroyed), latest first. Also on the bridge and relay.
