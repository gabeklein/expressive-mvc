---
"@expressive/mvc": minor
"@expressive/react": patch
---

Host registry moves to `@expressive/mvc/runtime`, and gains a transition seam.

**New subpath `@expressive/mvc/runtime`** is now the canonical home of the host registry: `host()`, `HostRuntime`, the `Host` augmentation manifest, `Fragment`, and the delegating helpers (`jsx`/`jsxs`/`jsxDEV`/`childrenOf`/`isElement`/`typeOf`/`propsOf`). `@expressive/mvc/jsx-runtime` remains the transform-contract module (`jsxImportSource` resolves element creation and the `JSX` namespace there) and re-exports the registry values, so existing imports keep working. One exception is type augmentation, which cannot follow re-exports: adapters extending `Host` must target `declare module '@expressive/mvc/runtime'`. `@expressive/react` and `@expressive/preact` are updated in this release; third-party hosts should retarget when they update.

**Transition seam:** `HostRuntime` gains an optional `transition(work)` member - the host's non-urgent update bracket - and `@expressive/mvc/runtime` exports a delegating `transition(work)` helper (new in this release; deliberately not re-exported from `jsx-runtime`). Unlike the element helpers, `transition` never requires a host: with none registered (or a host that declares no scheduler) the work simply runs inline, so host-agnostic code can call it unconditionally.

`@expressive/react` registers React's `startTransition` as the scheduler, so under the React host, state updates inside `transition(...)` present deferred - a suspending update holds prior content instead of flashing a fallback.

This establishes the pattern for host capabilities beyond element mechanics: `HostRuntime` members are plain functions the host uniquely owns, callable outside render, each with a sane fallback when absent; render-resident (hook-shaped) capabilities remain with the adapter. First consumer: `@expressive/router`'s deferred navigation (next release).
