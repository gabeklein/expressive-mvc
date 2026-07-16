---
"@expressive/mvc": minor
"@expressive/react": minor
---

Add `map()` for shallow reactive `Map` collections. With a factory, the map is string-keyed and spawning: `add(input?)` spawns through it - a string input is also the key (occupied keys throw), any other input keys by `String(value)` - and `set(key)` alone respawns. The map owns what it spawns - spawned `State` values are destroyed when deleted, cleared, or replaced - while values supplied via `set(key, value)` are guests. A `State` class may stand in for the factory - object input assigns fields via the constructor, string input keys the entry.
