---
"@expressive/mvc": minor
---

`State.on` now accepts a handler object in addition to the existing init callback, hooking distinct points of the class/instance lifecycle by cadence:

- `type` - per-class, runs once when the class is first bootstrapped, before its members are classified; receives the class so a handler may inspect or reshape the prototype first. A base-class handler runs for each subclass.
- `before` - per-instance, runs in the `prepare` phase before `observe`/`new()` (equivalent to a bare function).
- `after` - per-instance, runs at the `new()` slot after own values are observed; may return a cleanup.

The bare function overload is unchanged.

Additionally, bootstrap no longer reactively binds a non-configurable own member. This lets an adapter claim a member by sealing it in a `type` handler (e.g. keeping a Component's `render` unbound for the render chain) and mirrors the existing getter behaviour, which only binds configurable getters.
