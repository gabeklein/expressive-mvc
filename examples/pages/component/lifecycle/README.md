# Lifecycle

Three seams, three phases. Toggle the probe to watch each fire, then unwind in
reverse.

- **`new()`** runs at construction - synchronously, and during server render
  too. It belongs to setup the instance carries with it, and returns the
  teardown for when it is destroyed.
- **`mount()`** runs at commit, client only. Timers, listeners and anything
  reaching for `window` go here; its return value is the unmount cleanup.
- **`ref()`** fires when its element attaches, and its cleanup when the element
  detaches - which is not the same moment as unmount.

The transcript lives on `Demo`, so the probe can log its own destruction to
something that outlives it.
