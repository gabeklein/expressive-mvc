---
"@expressive/mvc": patch
---

A State stored on another State - through a `set()` factory or by assignment - is no longer re-provided into the holder's context when an ancestor context already provides that same instance.

The extra entry was redundant, and removing it later ran the cleanups of every subscriber notified by it, including ones which still resolved the instance from above. Reachable as a component reading a router field beside `Route`s: each Route storing the router via `set(() => this.get(Router))` re-provided it, and the subscriber stopped updating once one of those entries went away.
