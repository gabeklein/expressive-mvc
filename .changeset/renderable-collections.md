---
'@expressive/mvc': minor
'@expressive/react': patch
---

`has` lists and pools and `map`s declare themselves renderable to the core as they load, and a host adopts whatever was declared through `adopter`, exported from `@expressive/mvc/jsx-runtime`. The React adapter no longer imports `has` or `map` to patch them, so the collection code ships only in apps that import a collection: `Model` only 12.1 → 10.5 kB, a typical app 12.9 → 11.3 kB, an app using collections 12.1 kB. Declarations made before the host loaded are replayed, so import order does not matter.
