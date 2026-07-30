# Custom Instruction

`def` is the primitive every other instruction is built on. It takes a factory
that runs at init and returns a property descriptor; a `set` in that descriptor
rewrites each assignment, which is all `clamped` and `slug` do here.

Instructions are ordinary functions, so they take arguments and get shared like
any other helper - `clamped(5, 0, 10)` is just a call. Push **Volume** past
either end, or type spaces and capitals into **Handle**.
