# Suspense

An async `set` factory resolves straight into its field, and reading it while
pending suspends the render.

## What to try

Both cards start pending and fill in as their requests land. **Ask again**
restarts them.

## What it teaches

**`fallback` is the whole of the wiring.** Every Component carries a suspense
boundary, so a field declaring what to show while pending is all it takes -
there is no `<Suspense>` anywhere in this example.

**Reading is what suspends.** `Greeter` renders `{this.greeting}`; because the
value has not resolved, the render suspends and its own fallback shows. No
loading flag, no `isPending`.

**A child can decline its boundary.** `fallback={false}` sends the suspension
up to `Panel` instead. That works here only because `Panel` owns the pending
value - a boundary rebuilds the subtree it retries, so state owned *below* the
boundary would be rebuilt and requested again forever.

**An async factory resolves once.** A fresh request means a fresh instance,
which is why asking again keys the owner.

## Where to look next

- **boundary** is the same seam for errors rather than pending values.
- **set** covers the non-async forms of the instruction.
