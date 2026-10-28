---
'@expressive/inspect': minor
---

Browser devtools panel served by the Vite plugin at `/__inspect/ui`: an ownership tree and flat table of every Model instance with live updates over the HMR socket and per-key editing. `get()` accepts per-call `limits` (depth/string/array/keys) for uncapped reads, and `set()` resolves a `{ $ref }` value to a live instance.
