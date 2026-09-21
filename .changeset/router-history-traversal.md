---
"@expressive/router": minor
---

Add arbitrary history traversal through `Router.go(delta)`, retain `back()` as
its common convenience, and remove `forward()`. Memory history storage is now a
protected implementation detail.
