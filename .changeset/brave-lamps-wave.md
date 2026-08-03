---
"@expressive/mvc": patch
---

Run effect cleanup when an effect terminates its own subject.

An effect which called `set(null)` on its own subject synchronously - during its first run or any re-run - left the cleanup it returned dangling. The terminal event completed inside `set(null)`, before the effect had returned, so its cleanup registered after listeners were already cleared and never fired. Resources held there, such as timers or sockets, would leak.

Cleanup returned by a run which terminated its subject now fires immediately with `null`, matching the normal destruction path.
