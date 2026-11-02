---
"@expressive/dom": minor
---

`render(node, container, ...packs)` takes macro packs for that root - `render(<App />, el, css, app)` replaces `macro(css)` in the entry. Each root gets its own macros and global rules, so two roots on one page can differ. `macro()` still registers a pack for every root, and no longer throws after the first render.
