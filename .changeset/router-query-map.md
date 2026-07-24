---
"@expressive/router": minor
---

**Breaking:** `Router.query` (and the `Route.query` facade) is now a reactive `map` (`map.Insert<string, string>`) rather than a proxied record. Read a param with `query.get('foo')`, write with `query.set('foo', value)`, and remove with `query.delete('foo')` - each write still navigates by pushing a history entry, exactly as before. Reading a key subscribes to just that param, and URL-driven changes reconcile the same map in place.

Migration: replace property access (`query.foo`, `query.foo = x`, `delete query.foo`) with the map methods above. The per-key `declare query: { ... }` narrowing is removed - a `map` cannot carry an object-shaped key type; `query` is uniformly keyed by `string`.
