---
"@expressive/mvc": minor
"@expressive/react": patch
---

Host registry moves to `@expressive/mvc/runtime`, and gains a transition seam.

**Breaking:** the host registry now lives at the new subpath `@expressive/mvc/runtime` - `host()`, `HostRuntime`, the `Host` augmentation manifest, `Fragment`, the introspection helpers (`childrenOf`/`isElement`/`typeOf`/`propsOf`), and element creation. `@expressive/mvc/jsx-runtime` is constrained to exactly the transform contract - `jsx`, `jsxs`, `Fragment`, and the `JSX` namespace, which is all `jsxImportSource` resolves there. Imports of anything else from `jsx-runtime` must retarget to `@expressive/mvc/runtime`; likewise adapters extending `Host` must augment `declare module '@expressive/mvc/runtime'` (augmentation cannot follow re-exports regardless). No published pairing breaks - 0.x caret ranges pin every shipped adapter and router to mvc 0.82 - and in-repo consumers are updated in this release.

**Transition seam:** `HostRuntime` gains an optional `transition(work)` member - the host's non-urgent update bracket - and `@expressive/mvc/runtime` exports a delegating `transition(work)` helper (new in this release; deliberately not re-exported from `jsx-runtime`). Unlike the element helpers, `transition` never requires a host: with none registered (or a host that declares no scheduler) the work simply runs inline, so host-agnostic code can call it unconditionally.

`@expressive/react` registers React's `startTransition` as the scheduler. Updates scheduled synchronously through the host callback receive React's Transition priority. Expressive model subscriber notifications remain microtask-batched; transition propagation through that dispatch path is not part of this release.

This establishes the pattern for host capabilities beyond element mechanics: `HostRuntime` members are plain functions the host uniquely owns, callable outside render, each with a sane fallback when absent; render-resident (hook-shaped) capabilities remain with the adapter.
