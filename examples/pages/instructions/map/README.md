# Presence

`map` with a factory owns its members and keys them; `set(id, name)` spawns one
and forwards the extra argument along. Rendering `{people}` drops the whole
collection in, since members are elements.

The detail pane reads `people.get(selected)`, which subscribes to that one key
- so it re-renders when the selection changes or when *that* person does, not
when the other three do. Each `Person` reads `get(Room)` to change the
selection without a prop.
