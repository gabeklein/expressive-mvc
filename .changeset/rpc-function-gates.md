---
"@expressive/rpc": minor
---

A folder's gate may be a function: an index's default run before each call in its folder and below. The Models it activates belong to that call. They are in reach of `.get()`, waited on until ready, and destroyed when it ends, and one whose `new()` fails refuses the call with its error, unreported.
