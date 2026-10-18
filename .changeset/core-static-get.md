---
'@expressive/mvc': minor
---

`Model.get` is defined in core and may be overridden. An override takes its own arguments and calls `getter(this, lookup)` from the new `@expressive/mvc/getter` subpath once, synchronously, to keep host context and render tracking - `User.get(id)`. `state.get(Type, ...args)` and a `get(Type, key, ...)` instruction call `Type.get` with that instance as origin, so they follow an override. `provide(provider)` from the same subpath registers a host's lookup. Outside a host render, `Model.get()` reads the root context.
