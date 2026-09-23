---
"@expressive/jsx": minor
---

Compose conditional class tokens and inline declarations through recursive `style` arrays. Strings now become classes, objects merge left-to-right, `class` combines with composed classes on elements, and a component's `style` forwards to its host root unless the component reads it while rendering. The React-specific `className` alias is removed.
