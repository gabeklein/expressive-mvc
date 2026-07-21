---
"@expressive/mvc": minor
"@expressive/react": minor
---

Add `has()`, a field instruction for owned reactive collections. With no argument or an iterable, it is an ordered list (`has.List<T>`): positional reads (`get(index)`, ranges, `get(predicate)`), `push`/`put`/`set(index)`/`pop`, with index-and-length precision tracking. With a `State` class or factory, it is a pool (`has.Pool<T, A>`): `add(...args)` spawns through the constructor or factory - forwarding arguments exactly as `Type.new()` accepts them - and returns the member, which is its own identity for `has`/`delete`/eviction. Pools own what they spawn: deleting, clearing, or destroying the owner destroys spawned `State` members, while values the factory passes through from its arguments stay guests. Fresh members are parented to the hosting state and activate inside its context; a member that dies evicts itself. Both modes share `map(fn)`/`filter(fn)`/`any`/`all` and snapshot via `get()`. The runtime classes are exposed as `has.List` and `has.Pool` for adapter facades.

In `@expressive/react`, a collection renders directly - `<ul>{this.todos}</ul>` - through a `$$typeof` facade on those prototypes: the collection is one element whose members (each carrying their own identity) render in order, subscribing to collection shape without a manual spread or keys.
