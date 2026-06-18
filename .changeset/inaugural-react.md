---
"@expressive/react": minor
---

**Re-architected as a pure adapter.** With `Component` now living in `@expressive/mvc`, `@expressive/react` is a thin host adapter rather than the home of the component model. It completes the core class through three channels - a `Component.on` lifecycle hook, prototype attach (`bootstrap`, `isReactComponent`, error boundary), and type augmentation. The public surface is unchanged: `Component` and the instructions are still re-exported from here.

**Host-agnostic runtime subpath (#117).** The renderer-agnostic adapter core is published at `@expressive/react/runtime` - the `Runtime` seam, StrictMode-safe hooks (`useHook`/`useFactory`/`useReady`), and standalone `use(subject)`. This is the same layer `@expressive/preact` builds on, bringing the two adapters to parity. The old `@expressive/react/state` subpath is renamed to `/runtime`.

**Behavior.** `fallback={false}` now opts a `Component` out of its own Suspense boundary (Suspense-transparent) instead of being used as the fallback node (#123). Props omitted on rerender are cleared to `undefined` (#88); optional render props are preserved (#86).

**Breaking.** Import the agnostic runtime from `@expressive/react/runtime` (was `/state`). The `Observable` re-export is renamed to `Observer` (#151).
