---
"@expressive/router": patch
---

A section `default` now answers wherever the section is declared. Previously the lexical gate behind sibling `as`-arbitration ignored a scope's own `default`, while the same scope's `matched` counted it - so a section holding a 404 lost its slot whenever it competed with another `as`-bearing sibling (an index route, a second layout), rendering nothing at all, and an outer layout dropped its chrome when an inner section's default caught the path. Both verdicts now come from one predicate: a scope claims a path via a descendant match, or via its own `default`, which catches anything under the scope's path.

Consequently a scope holding a section 404 shadows later siblings declared under its path, per the usual first-match declaration order - move such a sibling above the section to keep it reachable.
