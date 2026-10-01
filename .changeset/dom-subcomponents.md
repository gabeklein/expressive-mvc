---
"@expressive/dom": minor
"@expressive/react": patch
---

`@expressive/dom` no longer rewrites PascalCase members of every State. A PascalCase method becomes a subcomponent only when rendered as an element, tracking its owner wherever it renders, and stays a plain method otherwise, so calling one outside a render no longer throws. A PascalCase function field is plain data and renders as an ordinary function component. Owners are tagged through `State.on({ bind })`, so a hot patch or a `set()` override keeps the subcomponent's state. `@expressive/react` keeps its own subcomponent setup on Component.
