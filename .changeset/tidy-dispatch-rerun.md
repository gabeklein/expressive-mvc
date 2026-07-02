---
"@expressive/mvc": patch
---

Fix a dropped refresh when an observer is re-notified within the same dispatch tick. The batched event queue coalesced handlers by identity and drained with `Set.forEach`, so a handler re-enqueued after it had already run in the current tick was silently skipped. This stranded a `.get()` subscription that observed both a field and a computed derived from that field (the field's change and the computed's recompute land in one tick): the component refreshed once, then froze. The queue now removes each handler before invoking it, so a same-tick re-enqueue runs again.
