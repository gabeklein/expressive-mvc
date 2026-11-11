---
"@expressive/rpc": minor
"@expressive/dev": patch
---

The `api/` folder is the server's router. A `[name]`, `[...]` or `(name)` module exporting `GET`, `POST`... answers its path with a `Response`, behind the gates of the folders along it, and never reaches the client; a plain-named module exporting one fails the build, and `files/(index).ts` answers a folder's own path. Each URL has one owner - `(files).ts` beside `files/` fails the build. `[id]` folders and files take a segment as a param, a `[...]` file the rest of the path (none included), matched static first, then param, then rest. A handler gets `(request, params)`, and a gate reads `Current.get().params`. `rpc({ base: "/api" })` serves the tree under a path, and the client's stubs send there.

`@expressive/dev`'s pages read `[name]`, `[...]` and `(name)` through rpc's `segmentOf`, so a page and an API route name a path the same way; a remote module exporting a request method is refused.
