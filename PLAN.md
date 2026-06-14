# PLAN: `State.on` staged handlers

## Goal

Generalize `State.on` from "register a per-instance init callback" into a single
public entry point for hooking the distinct stages of a class/instance lifecycle.
Keep the function overload (the common case) and add an object overload whose keys
name the stage being hooked.

## Motivation

`State.on(fn)` only reaches the per-instance *before* phase. Layers built on mvc
(the `Component` adapter first, plausibly router/forms/helper instructions next)
need to influence earlier phases - in particular, how a class's members are
classified during bootstrap, *before* they are reactively bound. Today the only
way to do that is to let bootstrap bind a method and then undo it from the
adapter (e.g. the preact `render`-restore hack, subcomponent re-promotion). A
stage-keyed `.on` lets a class claim members at the point bootstrap already
classifies them, with no second walk and no undo.

This is the seam the deferred core-subcomponents work needs; that work circles
back once this lands.

## API

```ts
State.on(fn)              // sugar for { before: fn } - per-instance, current behavior
State.on({ type, before, after })
```

Handler keys, by cadence (init queue
`prepare -> observe -> args -> new() -> register`):

| key      | cadence      | signature                              | purpose |
|----------|--------------|----------------------------------------|---------|
| `type`   | per-class    | `(type) => void`                       | runs once at bootstrap, before members are classified; receives the class so a handler may reshape the prototype first |
| `before` | per-instance | `(self) => ...` (current `State.Init`) | runs in `prepare`, before `observe`/`new()` |
| `after`  | per-instance | `(self) => void \| (() => void)`       | runs at the `new()` slot, after observe+args; may return cleanup |

Semantics:
- Multiple handlers per key accumulate (SETUP is a Set).
- `type` handlers resolve off the full chain, so a handler registered on a base
  (e.g. `Component`) runs for each subclass.

## Scope this branch

Three lifecycle handlers:

- `type` - per-class, run once in bootstrap's non-cached branch (before members
  are classified), reaching subclasses.
- `before` - per-instance, in the `prepare` phase (the bare `fn` overload routes here).
- `after` - per-instance, threaded into the init queue at the `new()` slot
  (`bootstrap` returns `{ setup, after }`; the queue places `...after` after `new()`).

Plus: bootstrap no longer reactively binds a non-configurable own member. An
adapter seals a member in its `type` handler to claim it - the Component adapter
seals `render` (kept unbound for the chain) and its subcomponent getters - so no
per-member claim stage is needed.

## Decisions

- One entry point (`.on`) with progressive disclosure (fn for common, object for
  advanced) over a sibling method like `State.setup` - keeps one concept.
- Three handlers keyed by cadence (one per-class `type`, a per-instance
  `before`/`after` pair) rather than per-member claim stages (`method`/`get`).
  Member reshaping is done imperatively in `type`, which receives the class: the
  "bounded claim" contract proved illusory (a handler redefines the prototype
  regardless), and dropping it removes the interceptor/effect split and the
  half-built member taxonomy.
- Core stays generic: bootstrap skips non-configurable members rather than
  naming `render`. The Component adapter claims `render` (and subcomponents) by
  sealing them in its `type` handler, before bootstrap classifies them.
