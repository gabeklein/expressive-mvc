# Managed Slots

`set` manages a slot beyond a plain field: a default value, a validator, or a
change-effect - each just a callback, no `useEffect`, no dependency array.

## What to try

Type more than twelve characters into **Display name** - the extra input is
rejected outright and the field never holds it. Then type into **Search** and
pause: the result only settles 500ms after you stop.

## What it teaches

**A callback can vet an assignment.** `name` pairs a default with a function
that runs before every write. Throwing `false` rejects the update, so the
invalid value is never stored - validation lives with the field rather than in
the handler that changes it.

**A callback can return a cleanup.** The cleanup runs before the next change,
so `query` debounces for free: each keystroke cancels the timer the previous
one started. That is the whole debounce - no effect, no deps, no ref to hold
the timer.

**Both are the same callback.** There is one signature for validating,
reacting, and cleaning up, because all three are "something to do when this
field changes."

## Where to look next

- **def** is the primitive `set` itself is built on, when you want to define
  your own instruction.
- **get** derives one field from others, or reaches into context.
