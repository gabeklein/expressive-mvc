---
'@expressive/inspect': minor
---

`parent`, `children`, `roots()`, `tree()` and `models()` report mvc's ownership (`get(State)`) instead of a field walk: host-mounted instances nest under the Component mounting them, and an active instance assigned into a field no longer counts as the holder's child. Orphan detection still treats a held instance as reached.
