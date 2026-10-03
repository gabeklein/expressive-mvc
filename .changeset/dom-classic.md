---
'@expressive/dom': minor
---

`createElement(type, props, ...children)` and `Fragment` are exported from `@expressive/dom` for classic JSX and code built without JSX. Point `jsxFactory`/`jsxFragmentFactory` at them, or use `import * as React from '@expressive/dom'` with tool defaults. Attributes are typed as with the automatic runtime; the root also exports the `JSX` namespace type, so `React.JSX` resolves under tool defaults. `Fragment` also works by name for keyed fragments, `<Fragment key={id}>`.
