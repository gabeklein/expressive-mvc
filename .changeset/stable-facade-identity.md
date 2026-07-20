---
"@expressive/mvc": patch
"@expressive/react": patch
---

Fix instances rendered through a subscriber proxy (such as from their owner's own render) losing element identity on every re-render, causing React to remount their placement and context teardown to destroy the live instance. The element facade now installs on the real instance so all proxies share one identity, and context teardown only destroys instances the context itself constructed.
