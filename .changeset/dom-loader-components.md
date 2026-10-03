---
'@expressive/dom': minor
---

`lazy` is removed. A function component that returns a promise of a component, or of a module with a `default` component, now renders as that component, so `const Settings = () => import('./Settings')` replaces `lazy(() => import('./Settings'))`. It suspends until the promise settles. The result is kept per function, so later renders and other placements render the loaded component without calling it again. A failed load reaches the nearest `catch`, and the render after recovery loads again. A loader takes no parameters. JSX types the element's attributes from the loaded component, including a State or Component class, and a Route's `as` accepts a loader.
