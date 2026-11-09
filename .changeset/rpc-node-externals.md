---
"@expressive/rpc": minor
---

The server bundle honors the app's own `environments.rpc.resolve` externals: set `noExternal` (or `external`) and dependencies stay installed instead of bundled - for a Node server with `pg` or `firebase-admin`. Without either, it still bundles everything for a Worker. The calls module is bundled either way.
