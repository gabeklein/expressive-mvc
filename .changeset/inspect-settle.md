---
'@expressive/inspect': patch
---

`act()` and the bridge's `around()` settle once a macrotask passes with no new recorded frame, capped at one second, instead of after a single `setTimeout(0)` - work deferred through timer or promise chains now lands in the returned frames.
