# Error Boundary

Override `catch()` and a Component becomes the boundary for everything it
renders - per-feature error handling without nesting `<ErrorBoundary>`
wrappers.

## What to try

Break the first card: it swaps to a fallback in place while the rest of the
page stays put, and **Retry** puts it back. Break the second and the whole
group goes, because that one declines to handle its own error.

## What it teaches

**Catching is a method, not a wrapper.** Any Component that defines `catch()`
covers its subtree. `Boundary` here has no `render()` at all - it exists only
to sit in the tree and catch.

**Handle in place or escalate.** `Recoverable` keeps its error and shows its
own fallback. `Escalating` rethrows, so the error travels up to the nearest
ancestor that will take it. The decision is one method on the class that
failed.

**Returning a promise holds the fallback.** `catch()` returns a promise that
stays pending until the user acts. Resolving immediately would re-render,
throw again, and loop.

## Where to look next

- **suspense** is the same seam for pending values instead of errors.
- **headless** is the pattern of a Component that renders nothing and exists
  to own a scope.
