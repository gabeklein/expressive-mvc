---
"@expressive/router": minor
---

A section `default` now answers wherever the section is declared. Previously the lexical gate behind sibling `as`-arbitration ignored a scope's own `default`, while the same scope's `matched` counted it - so a section holding a 404 lost its slot whenever it competed with another `as`-bearing sibling (an index route, a second layout), rendering nothing at all, and an outer layout dropped its chrome when an inner section's default caught the path. Both verdicts now come from one predicate: a scope claims a path via a descendant match, or via its own `default`, which catches anything under the scope's path.

**Breaking:** a scope holding a section 404 now owns everything under its path, per the usual first-match declaration order - and because a later sibling declared under it is statically dead, the router **throws** on that shape rather than leaving the route silently unreachable. A flat `<Route to="docs/team/roster">` declared after a `docs` section that owns a `default` was reachable before; it now raises `Route "/docs/team/roster" is unreachable` - move it above the section (or into it) to restore it.
