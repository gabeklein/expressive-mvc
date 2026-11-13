---
"@expressive/dom": minor
---

`<title>`, `<meta>` and `<link>` render into `document.head` from anywhere, outside SVG - the latest title wins and unmounting restores the one before. `renderToString` returns them as `head`.
