---
'@expressive/dom': patch
---

A `pending()` update that reveals new content whose State suspends - a `State.use()` slot, an owned child, or a State element loading data - now holds the current screen and commits once the data arrives. Previously the new State was destroyed while its value was still loading, an unhandled "is destroyed" rejection escaped, and the update never committed. Router navigates through `pending()`, so navigating to a page whose State loads on entry was affected. New content the update adds stays off the page until it commits - the waiting part, markup around it, and new siblings beside it - and the content it replaces stays meanwhile. `mount()` on new State runs once it is on the page, and never for new content an unhandled error discards.
