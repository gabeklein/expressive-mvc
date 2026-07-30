# Custom Control

The arc, the slider and the number input are three views of one field, and none
of them knows the others exist. `Manuscript` extends `Scale` and holds the
value; each control finds whichever scale encloses it, so a fourth view means a
fourth reader and nothing else.

No control is passed a value or a change handler - they call `scale.to(n)` and
re-render because they read `value`. Configuration is fields overridden on the
subclass, so a new dial is a new class rather than a new set of props.
