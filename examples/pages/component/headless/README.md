# Headless

A Component without `render()` draws nothing. Children pass through its
context provider, which makes placement in the tree the entire feature.

## What to try

Two tickers run side by side at different rates. Same `Readout` class in both
- each one finds the `Ticker` directly above it.

## What it teaches

**No render, still a component.** `Ticker` has fields, a `mount()` and a
lifecycle, but nothing to draw. It owns behavior and scope rather than markup.

**Placement is the API.** Wrapping something in a `Ticker` puts it in that
ticker's scope. `Readout` asks for `Ticker.get()` and receives whichever one
encloses it - no props, no ids, no selector.

**It hosts the boundaries too.** A headless Component still carries the
suspense and error boundaries for everything below it, so it is a useful place
to put them even when it renders nothing.

## Where to look next

- **boundary** puts error handling on that same seam.
- **lifecycle** shows what `mount()` guarantees and when it runs.
