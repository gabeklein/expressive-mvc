---
'@expressive/mvc': minor
---

`<Component for={Type}>` holds the instance it constructs until the provider's own `mount()` runs, so effects declared in that class wait for the provider to commit.
