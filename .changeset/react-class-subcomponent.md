---
"@expressive/react": patch
---

A PascalCase field holding a class keeps it as-is - a `Component` class renders as itself instead of being called without `new`, including one assigned after first render.
