# Reactive Map

`map<string, number>()` is the insert mode: a reactive Map of values you place
by key with `set(key, value)` - no factory, no spawning.

## What to try

Nudge a count with ± , then type a name that already exists and add it - the
existing row bumps in place rather than duplicating.

## What it teaches

**Keys hold plain values.** Give `map` two types instead of a factory and it
behaves like a `Map` that anything reading it can subscribe to.

**Notification is per-key.** Changing one entry notifies readers of that
entry. Adding or removing a key notifies readers of the collection's shape.
A consumer reading a single count ignores every other change.

**It reads like the built-in.** `get`, `set`, `size`, `values()` and iteration
all behave as expected, so the reactivity is the only thing that is new.

## Where to look next

- **map (spawn)** takes a factory and owns the members it creates.
- **has (list)** stores values by position when keys add nothing.
