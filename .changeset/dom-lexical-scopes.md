---
"@expressive/dom": minor
---

Descendant scopes apply only to elements the caller's own JSX writes. A nested rule under a `_rule` on a child component element, such as `_card: { _label: {...} }`, no longer styles `_label` elements inside the child's render. The class from `_card` still reaches the child's root through `style`, and `children` the caller passes in still take the nested rules. A child meant to be restyled from outside exposes that through `style` or a managed prop.
