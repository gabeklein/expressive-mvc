---
'@expressive/mvc': minor
---

`State.use()` is declared and implemented in core. Outside a render it creates the instance in the ambient context (`Context.get()`, root unless a host overrides it), owned by that context until it pops - an app-wide instance is `Auth.use()` at an entry point. It throws if `get()` would already resolve that type there; nest `<Component for>` to scope another.

`static global` is deprecated. `State.new()` on a class declaring `true` registers like `use()` (arguments still go to the constructor), so a second one beside an explicitly registered instance now throws too.

Core now declares the full `State.get` and `State.use` types - `ForceRefresh`, `GetFactory`, `GetEffect`, `UseArgs` - and exports `UseState`, so host-agnostic code types against `@expressive/mvc` alone.
