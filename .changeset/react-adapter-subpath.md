---
"@expressive/react": minor
---

Rename the host-agnostic subpath `@expressive/react/runtime` to `@expressive/react/adapter`, and fix a circular import that crashed bundled apps.

**Breaking (subpath rename).** The renderer-agnostic layer is now imported from `@expressive/react/adapter` (was `/runtime`). Update imports accordingly; `@expressive/preact` has been moved over.

**Circular import fix.** Consuming the built package through a plain bundler (not Vite/src path-mapping) threw at module-eval time - `Cannot read properties of null` from the agnostic chunk - and the app never mounted. The runtime module re-exported `Consumer`/`Provider` from `context` while `context` imported the runtime primitives back, a value-level cycle the chunk-split build tripped on during initialization (live ESM bindings hid it in the monorepo).

`runtime.ts` is now a pure leaf of host-agnostic primitives that imports nothing internal; the new `adapter.ts` barrel owns the adapter wiring (the `State.get` / `State.use` / component registrations) and re-exports the public surface. The dependency graph is one-way and acyclic.

The `/adapter` surface is `Runtime`, `use`, `State`, `Consumer`, `Provider`. The internal StrictMode hooks (`useHook` / `useFactory` / `useReady`) are no longer re-exported there; they remain an implementation detail of the React adapter.
