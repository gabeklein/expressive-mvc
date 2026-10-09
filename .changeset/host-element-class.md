---
"@expressive/mvc": patch
"@expressive/react": patch
"@expressive/dom": patch
---

`Host` takes `elementClass`, the instance a class must construct to render on that host; `JSX.ElementType`'s class arm reads it, so a type written against `@expressive/mvc/jsx-runtime` (like router's `as`) renders under the host's own JSX. React and Preact declare their `Component`, dom declares `State`. The class arm is no longer `abstract`.
