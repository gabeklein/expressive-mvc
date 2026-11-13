---
'@expressive/dom': patch
---

The Vite plugin prebundles `@expressive/mvc/hot`, the runtime it injects. A cold dev start no longer re-optimizes dependencies and reloads the page partway through the first render.
