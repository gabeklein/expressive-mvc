---
"@expressive/router": minor
---

Make nested Router instances terminate the ambient Route hierarchy. Route trees
rendered by a nested Router now start from that Router's location, enabling
self-contained tabs, wizards, and other local navigation flows.
