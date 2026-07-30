# Suspense

An async `set` factory resolves straight into its field, and reading it while
pending suspends the render. Every Component carries a boundary for that, so
declaring `fallback` is the whole of the wiring - there is no `<Suspense>`
anywhere in this example.

A child can decline its own boundary with `fallback={false}`, sending the
suspension up to `Panel`. That works here only because `Panel` owns the pending
value: a boundary rebuilds the subtree it retries, so state owned *below* it
would be rebuilt and requested again forever.
