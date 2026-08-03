---
'@expressive/react': patch
---

Accept assignment to subcomponent fields, so a Component override such as `Sidebar = Sidebar` no longer throws `TypeError: Cannot set property ... which has only a getter` when built with `useDefineForClassFields: false` (the default for any `target` below ES2022).
