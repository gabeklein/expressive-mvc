---
"@expressive/router": minor
---

Navigation now commits through `Router.navigate`, which applies it with `pending()`, so moving to a page that is not ready yet holds the current screen until it is, rather than flashing the route's `fallback`. Cold load still falls back.

`BrowserRouter` now writes the address once the navigation is on screen rather than on click, matching how the platform navigates - the bar does not move until the next document is ready. Pushing on click left the address describing a page nobody had seen, so a Back press during the wait returned to what was already displayed and history collected entries for unseen pages.

`Router.navigating` reports a navigation which has yet to appear - drive progress bars, `aria-busy`, disabled controls from it. Read it beside the outgoing screen or in a wrapper around it, never inside the page itself, which would render that page urgently against the new path and forfeit the hold.

Reporting works whether the router is rendered (`<BrowserRouter>...</BrowserRouter>`) or only provided - settlement comes from the subscribers a navigation touched, not from a hook mounted in the tree.

Override `navigate(commit)` to stage the swap differently - `commit` applies the navigation and must run. Every navigation routes through one protected `next()` seam, so `BrowserRouter` overrides only that rather than `goto`.
