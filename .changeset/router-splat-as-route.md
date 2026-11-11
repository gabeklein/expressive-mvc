---
"@expressive/router": patch
---

A Route subclass given as a catch-all Route's `as` now matches the paths below it and reads the rest as `match['*']`. It used to match only the catch-all's own path.
