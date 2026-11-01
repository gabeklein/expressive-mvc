---
'@expressive/mvc': minor
---

`_` methods are no longer auto-bound. Like `_` accessors, they run on the instance when called through it or a tracking subject - so they never subscribe and can reach `#private` members - but a detached reference keeps the caller's `this`, and the `method` stage skips them.
