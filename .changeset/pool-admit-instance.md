---
"@expressive/mvc": minor
---

`has(Type)` pools now admit a ready-made member. `add(value)` with a lone instance of the pool's class (or a subclass) holds that value instead of forwarding it to the constructor, so one field both spawns and injects - a second pool over members of a first (`selected = has(Item)`) and fetch hydration (`items.add(new Item(data))`) no longer need an identity factory. Ownership is unchanged and still follows freshness: a fresh instance is adopted and destroyed with the pool, an already-activated one is a guest. Only a single argument is treated this way, so multi-argument constructors are unaffected, and factory pools never admit - their arguments are their own.
