---
"@expressive/mvc": minor
---

hot() objects gain a reactive snapshot seam. Reading `get()` on a hot object inside a watch context subscribes to every change of the collection - key add, key delete, and value writes - so getters aggregating over a keyed collection (e.g. `Object.values(this.items.get()).reduce(...)`) stay reactive. Plain enumeration of the proxy remains untracked. The object overload now types the snapshot: `hot<T>(value: T): T & { get(): Readonly<T> }`.
