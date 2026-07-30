# Custom Instruction

`def` is the low-level primitive every other instruction is built on. Both
fields here are governed by instructions defined right in this file - the same
way `set` and `get` are defined inside the library.

## What to try

Push **Volume** past either end with the ±3 buttons; it stops at 0 and 10.
Type a name with spaces or capitals into **Handle** and watch each keystroke
come back as a slug.

## What it teaches

**A factory that returns a descriptor.** `def` takes a function that runs when
the instance initializes and returns a property descriptor. Whatever it
returns becomes the behavior of that field.

**`set` in the descriptor rewrites the assignment.** Returning a value from
`set` stores that value instead of the one assigned - which is all `clamped`
and `slug` do. The consumer writes `this.volume += 3` and the instruction
decides what actually lands.

**Instructions are ordinary functions.** `clamped(5, 0, 10)` is a call, so
instructions take arguments, close over state, and get shared across classes
like any other helper. There is no registration step and nothing to extend.

## Where to look next

- **set** is the everyday form of this, for defaults, validation and effects.
- **get** is the same primitive aimed at derived values and context.
