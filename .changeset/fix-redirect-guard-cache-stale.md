---
"@expressive/router": patch
---

Fix stale redirect-guard verdict when a guarded route is reused across out-and-in navigation. A route that cedes to a sibling under a persistent parent now clears its cached guard verdict, so re-entry re-runs the guard instead of reusing a stale result or hanging on a settled async promise.
