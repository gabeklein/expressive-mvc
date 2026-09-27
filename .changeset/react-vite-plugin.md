---
"@expressive/react": minor
---

Add `@expressive/react/vite`, a dev-server plugin for class HMR: editing a `State` or `Component` class patches it in place, keeping instance state, alongside React Refresh for function components. Add it after `@vitejs/plugin-react`: `plugins: [react(), expressive()]`.
