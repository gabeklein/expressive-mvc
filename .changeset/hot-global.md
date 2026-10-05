---
'@expressive/mvc': patch
---

A module creating a `static global` with `.new()` at module scope no longer throws on a hot update when it re-runs - the new instance replaces the previous one, with a one-time warning per class. Outside hot patching, a second global still throws.
