---
'@expressive/mvc': minor
---

The `Host` interface of `@expressive/mvc/jsx-runtime` takes an optional `element` member: further element types the host renders, joined into `JSX.ElementType`. Code typed with that JSX, such as a router `Route`'s `as`, then accepts them under that host.
