# Error Boundary

Override `catch()` and a Component becomes the boundary for everything it
renders - per-feature error handling without nesting `<ErrorBoundary>`
wrappers. `Boundary` here has no `render()` at all; it exists to sit in the
tree and catch.

The class that failed decides what happens. The first card keeps its error and
swaps in a fallback while the rest of the page stays put; the second rethrows,
so the whole group goes. Returning a pending promise holds the fallback up -
resolving immediately would re-render, throw again, and loop.
