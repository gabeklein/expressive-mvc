---
'@expressive/mvc': minor
---

`State.get()` and `State.get(false)` work anywhere. Outside a render they return the instance unsubscribed, resolved from the ambient context `Context.get()` - root unless a host overrides it, so only globals resolve, and a not-found error says so. `get(true)` and `get(fn)` stay render-only and throw outside one.

A State constructed while the ambient context is not root anchors to it: its `get(Type)` fields and `state.get(Type)` resolve there, and a `static global` registers there. With no host override nothing changes.

`Context.get()` no longer takes a State - it is only the ambient context, so a host replaces one form. `Context.for(state)` returns the context a State resolves from.
