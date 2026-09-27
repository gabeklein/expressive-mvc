---
'@expressive/inspect': minor
---

`act()` - in process, on the bridge and over the relay - settles once a macrotask passes with no new recorded frame, instead of after a single `setTimeout(0)` - work deferred through timer or promise chains now lands in the returned frames. It takes `{ until, timeout, record }`: `until` waits first for work pending on I/O - `{ [address]: value }` pairs that must each hold, or addresses that must each see a frame after the step's synchronous writes, `timeout` caps the wait (default one second) and warns when it passes first, and `record` sets filters for the window, restoring the journal's after. Over the relay it answers `settled: false` and the `pending` targets instead of warning.

Add `journal.summary(query?)` - a per-instance digest of recorded frames (keys written with counts and last values, calls, destroyed), latest first. Also on the bridge and relay.
