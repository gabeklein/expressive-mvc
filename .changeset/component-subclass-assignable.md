---
'@expressive/mvc': patch
'@expressive/react': patch
---

A subclass of a Component subclass is assignable to its parent type, so a function taking a `Mesh` accepts a `Ball extends Mesh`, and `typeof Mesh` accepts `Ball`. The `is` and `catch` attributes no longer make `props` contravariant in the instance type. In React, the deprecated `state` member, which exists only to satisfy React's JSX, is typed `{}`.
