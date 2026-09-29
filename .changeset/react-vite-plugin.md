---
"@expressive/react": minor
---

Add `@expressive/react/vite`, a dev-server plugin for class HMR: editing a `State` or `Component` class patches it in place, keeping instance state, alongside React Refresh for function components. Add it after `@vitejs/plugin-react`: `plugins: [react(), expressive()]`. In the `ssr` environment the injected code carries no browser-only code and leaves a replaced class to the host (`hot.replaced` on `@expressive/mvc/runtime`).
