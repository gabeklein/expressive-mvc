---
'@expressive/mvc': minor
---

A global may no longer shadow another in root. Activation throws if root already resolves its type - including through a subclass instance - or if it would hide an instance whose class is one of its supertypes. Previously the newer global silently took the shared slot, leaving the older instance alive but unreachable. To replace a global, destroy it first (`set(null)`). Sibling subtypes still coexist, contesting their shared base.
