---
"@expressive/router": minor
---

Navigation now commits through `Router.navigate`, which applies it with `pending()`, so moving to a page that is not ready yet holds the current screen until it is, rather than flashing the route's `fallback`. Cold load still falls back.

For in-app navigation, `BrowserRouter` now writes the address once the navigation is on screen rather than on click. Pushing on click left the address describing a page nobody had seen, so a Back press during the wait returned to what was already displayed and history collected entries for unseen pages. Browser-driven navigation (`popstate` or an external History API call) necessarily changes the address first, then settles the matching screen.

Direct `query.set`, `delete`, and `clear` writes use the same navigation path. Overlapping navigation is latest-wins: a superseded navigation cannot later change history or clear the active navigation's status.

`Router.navigating` reports a navigation which has yet to appear - drive progress bars, `aria-busy`, disabled controls from it. Read it beside the outgoing screen or in a wrapper around it, never inside the page itself, which would render that page urgently against the new path and forfeit the hold.

Reporting works whether the router is rendered (`<BrowserRouter>...</BrowserRouter>`) or only provided - settlement comes from the subscribers a navigation touched, not from a hook mounted in the tree.

Override `navigate(work)` to stage the swap differently - `work` applies the navigation and must run. Status and latest-wins settlement wrap that seam, so an override need not call `super`. Every navigation routes through one protected `next()` seam, so `BrowserRouter` overrides only that rather than `goto`.
