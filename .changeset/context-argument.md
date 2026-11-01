---
'@expressive/mvc': minor
---

A `Context` is a valid constructor argument: `X.new(context)` makes it the instance's home - added explicitly as it activates, so `get()` resolves there, and removed when destroyed; `ctx.pop()` removes the entry, not the instance. `X.new(Context.root)` replaces adding an instance to root by hand.

- The first claim wins: a claim before activation - a host mounting the instance, `ctx.add`, `ctx.push`, or an owner adopting a field child - then the first context argument. Later context arguments are ignored, so an owned child's home is always its owner's.
- A context returned from a callback or `setup` handler only lists the instance there - it never sets the home.
- An instance placed in a host's context takes that host as owner for `get()`, as with `ctx.push`, but is not destroyed with it.
- `Component` no longer discards a context among its constructor arguments: `Panel.new(props, context)` adds it to that context. Under a host, the host's placement still wins.
