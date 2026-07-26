---
"@expressive/mvc": minor
"@expressive/react": minor
---

**Breaking:** `hot()` is removed. It predated the instruction model and never fit it - a free-standing proxy factory whose reactivity was silently lost the moment the field was reassigned, whose storage was shared with the value passed in, and whose shape (key enumeration, `length` beyond what a read touched) was not tracked at all. `map()` and `has()` now cover the same ground as proper field instructions: resolved at activation, re-entrant on the field, precise per-key/per-index events, owned `State` members, and snapshots.

Migration:

- keyed by name (a record) → `map()`: `values = map<string, string>()`, read `values.get('a')`, write `values.set('a', b)`.
- keyed by position (an array or fixed board) → `has()`: `board = has<string>(Array(9).fill(''))`, read `board.get(i)`, write `board.set(i, value)`.
- a growing list of owned `State` members → `has(Item)`, seeded from the `new()` hook with `add()`.
- a plain object of unrelated values that only ever changes wholesale → declare plain fields, or assign a new object.
