---
'@expressive/mvc': minor
---

`get(State)` reads ownership: `state.get(State)` and the `get(State)` instruction return the owning State (`false` for optional), and `state.get(State, callback, true)` / `get(State, true)` report the States one owns. An instance nothing claims before activation - a host-rendered Component, a `use()` instance, a `<Provider>`'s - is now owned by the State its enclosing context was set up for, rather than none.
