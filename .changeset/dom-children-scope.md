---
"@expressive/dom": minor
---

JSX now resolves `style()` rules in the component that wrote it. `children` passed to a wrapper - a router `Link`, a provider Component with no `render()`, any FC that places `children` - keep the author's rules, including rules nested in a `_rule` on the wrapper element. The wrapper's own rules no longer reach them; its base declarations still apply where they are its roots.
