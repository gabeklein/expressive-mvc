---
"@expressive/mvc": minor
---

A second global instance of the same type now throws on activation instead of silently evicting both from root. A duplicate `static global` singleton is nearly always a bug (double `.new()`, leaked test instance), and mutual eviction deferred the failure to a distant "Could not find X in context". Destroy the existing instance first (`set(null)`), or register additional instances explicitly via context. Sibling-subtype collisions at a shared ancestor keep the per-ancestor eviction semantics.
