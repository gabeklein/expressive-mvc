---
'@expressive/mvc': minor
---

A `Context` is a valid constructor argument: `X.new(context)` adds the instance to that context explicitly before it activates - so `get()` resolves there - and removes it when destroyed. Given several, the last wins. `X.new(Context.root)` replaces adding an instance to root by hand.
