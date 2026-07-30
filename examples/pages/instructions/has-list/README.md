# Owned List

`has<string>()` is the list mode: an ordered collection of plain values you
push, addressed by index. No spawned members, no keys - just a log.

## What to try

Record a few actions, then undo. The footer tracks both the length and the
latest entry.

## What it teaches

**Same instruction, no factory.** Give `has` a type instead of a class and it
stores values rather than spawning members. Push to append, pop to undo.

**Reads track precisely.** `get(-1)` re-renders on a new tail; `size`
re-renders on a length change. A consumer that reads only one of them ignores
the other.

**Negative indices count from the end,** so `get(-1)` is the latest entry
without arithmetic against `size`.

## Where to look next

- **has (pool)** spawns Component members instead of storing values.
- **map** addresses entries by key rather than position.
