---
'@expressive/dom': minor
---

Only a `Component` renders. A plain `Model` is no longer a JSX element or inline-renderable - `<Session />` and `{session}` throw, naming the fix: extend `Component` to render, or provide with `<Component for={Session}>`. `fallback`, `catch`, `mount`, `key` and `render` are no longer read from plain Models. Matches `@expressive/react`, where only Components render. PascalCase subcomponents on any Model are unchanged.
