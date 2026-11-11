---
"@expressive/dom": patch
---

An unkeyed child keeps its element, component instance and state when a conditional sibling before it appears or disappears. Children now match by their position in the written JSX, holes included, instead of by index among the rendered ones - `{open && <Confirm />}<Editor />` no longer remounts `Editor`.
