---
"@expressive/mvc": patch
---

Fix two error paths that reported internals instead of the mistake.

An enumerable property declared on a State subclass's prototype crashed
activation with `undefined is not an object (evaluating 'property.value')`.
`for-in` enumerates such a key but `getOwnPropertyDescriptor` returns nothing for
it, and the `def` and `observe` sweeps assumed a descriptor. Keys with no own
descriptor are now skipped - prototype members are unmanaged by design, the same
as methods.

Using a destroyed state threw `Object is not observable (terminated).`, naming an
internal slot rather than the error. It now names the state and what cannot be
done with it: `Foo-a1b2c3 was destroyed - a destroyed state cannot be rendered,
watched or updated.`
