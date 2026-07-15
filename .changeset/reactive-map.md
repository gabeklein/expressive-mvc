---
"@expressive/mvc": minor
"@expressive/react": minor
---

Add `map()` for shallow reactive `Map` collections. With a factory, `add(key)` spawns values for vacant keys (occupied keys throw), `set(key)` alone respawns through the factory, and the map owns what it spawns: spawned `State` values are destroyed when deleted, cleared, or replaced, while values supplied via `set` are guests. A zero-arity factory returns whole `[key, value]` entries via `add()`, and a `State` class may stand in for the factory - `add(input?)` instantiates it, keyed by natural id.
