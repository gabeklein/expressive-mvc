# Owned Collections

`has(Item)` is a pool that spawns and owns its members. Each todo is its own
Component, so dropping the pool into the tree is the whole render.

## What to try

Add a task, toggle a few done, then clear them. Note what the parent never
writes: no keys, no `.map()`, no row wrapper, no props passed down.

## What it teaches

**`add` spawns a member and returns it.** `this.todos.add({ text })`
constructs an `Item`, seeds its fields and files it in the pool. The parent
holds the pool, not an array it has to keep in sync.

**Members carry their own identity.** `<ul>{todos}</ul>` renders the pool
directly, because an instance *is* an element. Identity comes from the member
itself, which is why there are no keys to invent.

**Members own their behavior.** `toggle` and `remove` live on `Item`, next to
the fields they change. `this.set(null)` destroys a member, and the pool
evicts it automatically - the parent is never told.

**Pools resolve at activation.** Seeding happens in the `new()` hook rather
than at the field, because the pool is not addressable until the instance is
live.

## Where to look next

- **has (list)** is the same instruction storing plain values by position.
- **map** keys spawned members instead of pooling them anonymously.
