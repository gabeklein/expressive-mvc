---
"@expressive/rpc": minor
"@expressive/dev": patch
---

A folder's gate runs per request by default: its instance ends after the last call holding it, so a logout or revoked session takes effect on the next call. `static ttl` still caches one per key, and `set(null)` on it ends it early. dev keeps its seats for 300 seconds by default, as before.
