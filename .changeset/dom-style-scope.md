---
"@expressive/dom": patch
---

Base declarations in a `style()` map now beat `macro()` global rules, as documented. A component's own rule shadowing a global one stacks on it instead of merging it in. A component instance placed as `{child}` no longer inherits the placing component's base declarations or rules. A macro returning its own name as `true` with nothing below it now throws `Macro "name" returned itself.`, and the host rejects a bare `true` value.
