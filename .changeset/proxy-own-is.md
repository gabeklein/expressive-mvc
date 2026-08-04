---
"@expressive/mvc": patch
---

Tracking proxies now carry `is` as an own writable property.

Value is unchanged - `is` still resolves to the subject instance - but the
property no longer comes from the non-writable one on the instance. Test runners
that diff a proxy (the value handed to effects and renders) against a State
crashed while building the diff: vitest clones both sides through the prototype
chain and assigns onto the clone, which threw `Cannot assign to read only
property 'is'` and replaced the real assertion failure with a TypeError.
