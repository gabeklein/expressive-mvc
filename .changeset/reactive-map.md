---
"@expressive/mvc": minor
"@expressive/react": minor
---

Add `map()` for shallow reactive `Map` collections. With a factory, the map is string-keyed and spawning: `add(key)` creates for vacant keys (occupied keys throw), keyless `add()` derives the key from `String(value)`, and `set(key)` alone respawns through the factory. The map owns what it spawns - spawned `State` values are destroyed when deleted, cleared, or replaced - while values supplied via `set(key, value)` are guests. A `State` class may stand in for the factory, forwarding the key to its constructor.
