---
'@expressive/mvc': minor
---

**Behavior change:** a write to a destroyed state no longer throws. It is stored without dispatch - the writer reads back what it wrote, so a continuation like `do { this.again = false; await ... } while (this.again)` runs to its end - and reported to `catch` handlers as `Caught.Destroyed`. Unhandled, it outputs nothing; a handler can escalate it (`State.on({ catch: (e) => { throw e } })` to fail a test run) but can no longer drop the write. Silent `set(assign, true)` writes are reported too.

A late write is harmless on its own; repeated ones mean work outlived its owner - cancel it in a cleanup. Inspect counts them per instance.
