---
'@expressive/mvc': minor
---

`Model.get` is defined in core and may be overridden: an override handles its own arguments, delegates base forms to `super.get(arg)`, and resolves its own by calling `Context.get(this, compute)` once, synchronously, to keep host context and render tracking - `User.get(id)`. `Context.get(Type, compute)` resolves such a lookup; bare `Context.get()` returns the current context, else root. `state.get(Type, ...args)` and a `get(Type, key, ...)` instruction call `Type.get` with that instance's context current and the instance as origin, so they follow an override. Elsewhere `Context.get` defers to the assignable `Context.resolve(Type, compute)` - root by default; hosts supply render context and tracking there.
