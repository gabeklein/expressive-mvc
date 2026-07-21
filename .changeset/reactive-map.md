---
"@expressive/mvc": minor
"@expressive/react": minor
---

Add `map()`, a field instruction for shallow reactive maps - the field resolves at activation and the hosting state adopts the map in the same step. With no argument or an iterable of entries, it is a plain keyed map (`map.Keyed<K, V>`, extending native `Map`). With a factory function, it is a keyed spawning map (`map.Create<A, V>`, keyed by `A[0]`): `set(...args)` invokes the factory verbatim and stores the result at the first argument, replacing (and destroying, if owned) any previous value. Spawning maps own what the factory makes - spawned `State` values are destroyed when deleted, cleared, or replaced - while values the factory passes through from its arguments stay guests. A map held by a `State` field adopts fresh members: parented to the owner, activated inside its context, and destroyed with it; the field is read-only, and a dead `State` value evicts itself from the map. `get()` with no key returns a shallow `ReadonlyMap` snapshot; `keys(fn)` / `values(fn)` / `entries(fn)` return reusable transformed iterables.
