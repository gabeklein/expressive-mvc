---
'@expressive/mvc': minor
---

`<Component for={Type}>` no longer defines `mount` on the provider or calls it on the instance it constructs - that instance is a child of the provider, so its effects wait for the provider's commit and a replacement while committed is released at once.
