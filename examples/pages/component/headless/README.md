# Headless

A Component without `render()` draws nothing. Children pass through its context
provider, which makes placement in the tree the entire feature: `Ticker` has
fields, a `mount()` and a lifecycle, but nothing to draw.

Wrapping something in a `Ticker` puts it in that ticker's scope, so the same
`Readout` class finds a different one on each side - no props, no ids, no
selector. A headless Component still hosts the suspense and error boundaries
for everything below it.
