---
'@expressive/mvc': patch
---

`get(Type)` resolves any ancestor, not just the direct parent - a grandparent or a `has()` pool member's owner's owner resolves without a context. Nearest wins by depth; an ancestor beats a sibling at its own level.
