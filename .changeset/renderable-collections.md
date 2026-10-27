---
'@expressive/mvc': minor
'@expressive/react': patch
---

Renderable classes declare themselves to the core as they load - `Component`, `has` lists and pools, and `map` collections - and a host adopts every declared class through `adopter`, exported from `@expressive/mvc/jsx-runtime`, with one element seam. Each promises the same protocol: `is` names the instance behind a derived view and `render()` returns what to show; the collections gain both members. The React adapter no longer imports `has` or `map` to patch them, so collection code ships only in apps that import a collection: `Model` only 12.1 → 10.4 kB, a typical app 12.9 → 11.3 kB, an app using collections 12.1 kB. Declarations made before the host loaded are replayed, so import order does not matter.
