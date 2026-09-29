---
"@expressive/dom": minor
---

Add `@expressive/dom/vite`, a dev-server plugin for class HMR: editing a `State` or `Component` class patches it in place, keeping instance state, including its subcomponents and `style()` maps. Function components are not refreshed yet - a module exporting one reloads when edited. In the `ssr` environment the injected code carries no browser-only code and leaves a replaced class to the host (`hot.replaced` on `@expressive/mvc/runtime`).
