---
"@expressive/dom": patch
---

Published types now include the `Component.mount` augmentation. It was emitted in a declaration chunk nothing referenced, so a `mount()` method went unchecked against its signature.
