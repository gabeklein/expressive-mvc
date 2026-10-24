---
'@expressive/mvc': minor
---

`Model.get` is defined in core and may be overridden: an override handles its own arguments, delegates base forms to `super.get(arg)`, and resolves its own by calling `Context.get(this, compute)` once, synchronously, to keep host context and render tracking - `User.get(id)`. `Context.get(Type, compute)` resolves such a lookup; bare `Context.get()` returns the current context, else root. `Context.set(target, fn)` runs `fn` with a Model's context (that Model as origin) or a Context current, read through the readonly `Context.current`; every static `get` inside resolves there. `state.get(Type, ...args)` and a `get(Type, key, ...)` instruction call `Type.get` with that instance as origin, so they follow an override.
