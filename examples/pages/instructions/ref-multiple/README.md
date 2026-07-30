# Ref Proxy

`ref(this)` is the plural form: one call hands back an imperative handle for
*every* field, keyed by name.

## What to try

Fill in a field or two - the counter tracks how many are filled - then hit
**Clear all** and watch one loop empty the whole form.

## What it teaches

**One proxy, every field.** `refs.first` is a callable ref for `first`,
`refs.email` for `email`, and so on. Adding a field to the class adds a handle
without touching the ref.

**Calling the handle writes the field.** `refs.first('Ada')` assigns, which is
why each input can change through the proxy and why `clear()` is a loop rather
than three assignments.

**No `useRef` per input.** The class already knows its own fields, so the
handles come from the shape of the state instead of from the render body.

## Where to look next

- **ref (single)** holds one value - typically a DOM node.
- **def** is how a plural instruction like this one is built.
