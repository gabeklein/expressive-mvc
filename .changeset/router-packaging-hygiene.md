---
"@expressive/router": patch
---

Packaging hygiene: drop the `react` peer dependency and declare `sideEffects: false`.

The router is host-agnostic - its runtime imports are `@expressive/mvc` entries only, so nothing here requires React itself. The hard peer range (`>=16.8.0 <20.0.0`) produced unmet-peer warnings for non-React hosts and belongs to the adapter, which already declares React as an optional peer. Installing under React is unchanged: the adapter's own peering still applies.

`sideEffects: false` lets bundlers tree-shake the package like `@expressive/mvc`; no module runs anything at import time. Also aligns publish metadata with sibling packages (`publishConfig.access`) and removes a vestigial npm-based `preversion` script - releases run through changesets CI.
