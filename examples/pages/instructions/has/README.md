# Owned Collections

`has(Item)` is a pool that spawns and owns its members. `add` constructs an
`Item`, seeds it and files it away; because an instance is an element,
`<ul>{todos}</ul>` is the whole render - no keys, no `.map()`, no row wrapper.

Members own their behavior too. `toggle` and `remove` live on `Item`, and
`this.set(null)` destroys a member which the pool then evicts on its own. Pools
resolve at activation, so seeding happens in `new()` rather than at the field.
