# Reactive Map

Give `map` two types instead of a factory and it becomes a reactive `Map` you
fill yourself with `set(key, value)`. `get`, `size`, `values()` and iteration
all behave as expected - the reactivity is the only new thing.

Notification is per-key: changing one entry notifies readers of that entry,
while adding or removing a key notifies readers of the collection's shape. Add
a name that already exists and its row bumps in place.
