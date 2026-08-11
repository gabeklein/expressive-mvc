---
"@expressive/mvc": minor
"@expressive/react": minor
---

Deferred presentation arrives as `defer(work)`, replacing the free `transition()` export it supersedes.

Work marked this way is non-urgent, so React keeps current content on screen while a replacement gets ready rather than falling back. Writes inside run immediately - only notification defers - and may target any state. The returned promise settles once every subscriber the work touched has **absorbed** it: under React, once the update commits.

A free function rather than a method, because nothing about it is bound to one state. The bracket is global and settlement comes from whichever subscribers the writes happen to touch, so a receiver would only imply a scope that does not exist.

Subscribers which cannot report presentation - unmounted, hidden inside an `Activity` tree, or a host with no scheduler - settle on replay rather than holding.

Note that a subscriber carries one update at one priority, so one which reads a pending flag must not rebuild the deferred content on the same pass - read it from a sibling, or from a wrapper taking that content as `children`.

Migrating: `transition(() => …)` becomes `defer(() => …)`. `HostRuntime.transition` is now a plain bracket returning nothing; hosts no longer report presentation through it.
