---
"@expressive/dev": minor
---

`expressive build --prerender` writes static HTML for each page that needs nothing at request time, rendered in headless Chrome (`playwright-core`, an optional peer). Folders with a `remote.ts` or `remote/`, and `[param]`/`[...]` routes, stay client-rendered. The empty shell moves to `200.html`, and the built service serves a page's `index.html` before falling back to it.
