---
'@expressive/mvc': minor
---

**Behavior change:** a write to a destroyed state no longer throws. It is stored without dispatch - the writer reads back what it wrote, so a continuation like `do { this.again = false; await ... } while (this.again)` runs to its end - and reported as `Caught.Destroyed`, now a warning: unhandled, it logs. A handler can no longer drop the write; returning nothing only silences the report. Silent `set(assign, true)` stores without a report.

A late write means work outlived its owner: cancel it in a cleanup, or handle `Caught.Destroyed` where late writes are expected.
