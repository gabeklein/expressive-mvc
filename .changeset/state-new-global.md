---
'@expressive/mvc': minor
---

`State.new(true, ...args)` registers the instance as a global without a `static global` declaration. `static global` stays the policy: `false` (own or inherited) or a resolver returning false throws; an inherited `true` no longer needs re-declaring for this call.

A global may no longer shadow another in root. Activation throws if root already resolves the type - including through a subclass instance - or if it would hide an instance of exactly one of its supertypes. Previously a global supertype or subtype silently evicted the other. Sibling subtypes still coexist, contesting their shared base.
