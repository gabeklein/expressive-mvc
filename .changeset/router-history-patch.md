---
'@expressive/router': patch
---

`BrowserRouter` instances share one `history.pushState` / `replaceState` patch, removed with the last of them. Previously each wrapped the current methods and restored its own capture on teardown, so destroying a router other than the most recent dropped the live router's wrapper - it then missed external `pushState` and `replaceState` calls.
