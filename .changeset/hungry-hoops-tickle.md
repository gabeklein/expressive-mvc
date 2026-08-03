---
"@expressive/mvc": patch
---

Scope effects created during activation to the state that creates them.

A State activated inside another state's effect registered its own activation-time
effects into the enclosing effect scope. The enclosing effect's next run tore them
down permanently, leaving the inner state inert - it would render once and then stop
responding to updates. Activation now captures its own scope, so those effects belong
to the state being activated and survive unrelated reruns.

As part of the same scoping, an effect a state registers on a *different* state during
activation is now released when that state is destroyed, rather than outliving it.
