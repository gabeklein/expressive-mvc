# Custom Control

The arc, the slider and the number input are three views of one field, and
none of them knows the others exist.

## What to try

Drag the arc, or focus it and use the arrow keys. Then move the slider or type
a number - everything stays in step because there is only ever one value.

## What it teaches

**The value lives above its controls.** `Manuscript` extends `Scale` and holds
the number. Each control reads `Scale.get()` to find whichever scale encloses
it, so adding a fourth view means writing a fourth reader and nothing else.

**Coordination without wiring.** No control is passed a value or a change
handler. They call `scale.to(n)` and re-render because they read `value`.

**A subclass supplies the configuration.** `value` and `max` are just fields
overridden on the subclass, so a new dial is a new class rather than a new set
of props.

**`children` declared on `render` is a required slot,** which is how `Arc` lets
the caller decide what sits in the well.

## Where to look next

- **subcomponents** covers overriding rendering seams on a base class.
- **headless** is the same context trick with nothing rendered at all.
