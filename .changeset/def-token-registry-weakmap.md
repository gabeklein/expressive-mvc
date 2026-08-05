---
"@expressive/mvc": patch
---

Instruction tokens are now held weakly, so an instruction that never lands on an activated instance (shadowed by a subclass initializer, or constructed without activation) no longer retains its factory for the process lifetime.
