---
"@expressive/mvc": minor
"@expressive/react": patch
---

Host registry moves to `@expressive/mvc/runtime`, and gains a transition seam.

**Breaking:** the host registry now lives at the new subpath `@expressive/mvc/runtime` - `host()`, `HostRuntime`, the `Host` augmentation manifest, `Fragment`, the introspection helpers (`childrenOf`/`isElement`/`typeOf`/`propsOf`), and element creation. `@expressive/mvc/jsx-runtime` is constrained to exactly the transform contract - `jsx`, `jsxs`, `Fragment`, and the `JSX` namespace, which is all `jsxImportSource` resolves there. Imports of anything else from `jsx-runtime` must retarget to `@expressive/mvc/runtime`; likewise adapters extending `Host` must augment `declare module '@expressive/mvc/runtime'` (augmentation cannot follow re-exports regardless). No published pairing breaks - 0.x caret ranges pin every shipped adapter and router to mvc 0.82 - and in-repo consumers are updated in this release.

**Transition seam:** `HostRuntime` gains an optional `transition(work)` member - the host's non-urgent update bracket - and `@expressive/mvc/runtime` exports `transition(work)` (new in this release; deliberately not re-exported from `jsx-runtime`). The helper runs `work` inline while marking observable writes as non-urgent; affected subscriber callbacks are later replayed through the host bracket when the normal microtask dispatch flushes. Unlike the element helpers, `transition` never requires a host: with none registered (or a host that declares no scheduler), work and subscriber dispatch retain their normal timing.

`@expressive/react` registers React's `startTransition` as the scheduler. `State.get()`, `State.use()`, Component, and direct collection subscribers therefore receive React Transition priority without moving model mutation or core event dispatch into React. Urgent invalidation upgrades only subscriber work that is already pending for the same watcher; unrelated urgent work does not cancel deferred presentation.

This establishes the pattern for host capabilities beyond element mechanics: `HostRuntime` members are plain functions the host uniquely owns, callable outside render, each with a sane fallback when absent; render-resident (hook-shaped) capabilities remain with the adapter.
