---
'@expressive/mvc': minor
---

A `Context` is a valid constructor argument: `X.new(context)` makes it the instance's home - added explicitly as it activates, so `get()` resolves there, and removed when destroyed; `ctx.pop()` removes the entry, not the instance. `X.new(Context.root)` replaces adding an instance to root by hand.

- Given several context arguments, the last wins - they compose like initial values.
- A home given before activation - a host mounting the instance, `ctx.add`, `ctx.push` - wins over context arguments.
- A context returned from a callback or `setup` handler adds the instance there too; it becomes the home only if none was set.
- `Component` no longer discards a context among its constructor arguments: `Panel.new(props, context)` adds it to that context. Under a host, the host's placement still wins.
