---
'@expressive/dom': minor
---

A function component may return a promise of a component, or of a module with a `default` component, and renders as that component: `const Settings = () => import('./Settings')` then `<Settings tab="profile" />`. It suspends until the promise settles. The result is kept per function, so later renders and other placements render the loaded component without calling the loader again. A failed load reaches the nearest `catch`, and the render after recovery calls the loader again. JSX types the element's attributes from the loaded component.
