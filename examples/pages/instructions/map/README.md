# Presence

`map` with a factory owns its members and keys them. `set(id, name)` spawns a
member and forwards the extra argument to the factory.

## What to try

Click a name to select it; click a status dot to cycle that person without
selecting them. The detail pane on the right follows the selection.

## What it teaches

**Keyed, spawned members.** The room owns every `Person` and addresses them by
id. Rendering `{people}` drops the whole collection in - members are elements,
so there is nothing to map over.

**A read of one key subscribes to one key.** The detail pane reads
`people.get(selected)`, so it re-renders when the selection changes or when
*that* person changes - not when the other three do.

**Members reach back up.** `Person` reads `get(Room)` to know whether it is
selected and to change the selection on click. State flows through the shared
instance rather than through props and callbacks.

## Where to look next

- **map (insert)** is the same instruction without a factory, keying plain
  values you place yourself.
- **has** owns members without keys, when position or identity is enough.
