---
'@expressive/inspect': patch
---

Follows mvc's `catch(error, kind, key)`: `caught` counts and journal events key on the report's kind, and `stack` is where the error was thrown. A replacement a handler returns keeps the kind it replaced. Upgrade with `@expressive/mvc`.
