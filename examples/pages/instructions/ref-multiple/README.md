# Ref Proxy

`ref(this)` is the plural form: one call hands back a callable handle for every
field, keyed by name. Adding a field to the class adds a handle without
touching the ref.

Calling a handle writes its field, so each input changes through the proxy and
**Clear all** is a loop rather than three assignments. The handles come from
the shape of the state, not from `useRef` calls in the render body.
