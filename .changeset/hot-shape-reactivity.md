---
"@expressive/mvc": minor
---

hot() object enumeration is now shape-reactive. `Object.keys`/`values`/`entries`, spread, and `for...in` on a hot object inside a watch context now see the collection's real keys (previously they saw none) and subscribe to shape: adding or deleting a key re-runs the consumer, while writes to existing keys remain tracked per key. Getters aggregating over a keyed collection (e.g. `Object.values(this.items).reduce(...)`) now stay reactive. Enumerating a hot array subscribes to `length`.
