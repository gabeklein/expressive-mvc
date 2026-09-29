---
"@expressive/dom": minor
---

Add `@expressive/dom/vite`, a dev-server plugin for hot reload: editing a `State` or `Component` class patches it in place, keeping instance state, including its subcomponents and `style()` maps; editing a top-level function component re-renders it in place with its `State.use()` instances kept. In the `ssr` environment the injected code carries no browser-only code and leaves a replaced class to the host (`hot.replaced` on `@expressive/mvc/runtime`).
