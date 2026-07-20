---
"@expressive/mvc": minor
"@expressive/react": minor
---

Add `map()`, a field instruction for shallow reactive `Map` collections - the field resolves at activation and the hosting state adopts the map in the same step. With a factory, the map is string-keyed and spawning: `add(input?)` spawns through it - a string input is also the key (occupied keys throw), any other input keys by the value's own `key` or `String(value)` - and `set(key)` alone respawns. The map owns what it spawns - spawned `State` values are destroyed when deleted, cleared, or replaced - while activated values supplied via `set(key, value)` are guests. A `State` class may stand in for the factory - object input assigns fields via the constructor, string input keys the entry and becomes a `Component`'s identity `key` before the `new()` hook runs. A map held by a `State` field adopts fresh members: parented to the owner, activated inside its context, and destroyed with it; the field is read-only, and a dead `State` value evicts itself from every key it occupies. `keys(fn)` / `values(fn)` / `entries(fn)` return reusable transformed iterables.
