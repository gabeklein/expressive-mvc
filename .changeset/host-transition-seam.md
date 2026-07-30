---
"@expressive/mvc": minor
"@expressive/react": patch
---

Host transition seam: `HostRuntime` gains an optional `transition(work)` member - the host's non-urgent update bracket - and `@expressive/mvc/jsx-runtime` exports a delegating `transition(work)` helper. Unlike the element helpers, `transition` never requires a host: with none registered (or a host that declares no scheduler) the work simply runs inline, so it is safe to call from host-agnostic code unconditionally.

`@expressive/react` registers React's `startTransition` as the scheduler, so under the React host, state updates inside `transition(...)` present deferred - a suspending update holds prior content instead of flashing a fallback.

This establishes the pattern for host capabilities beyond element mechanics: `HostRuntime` members are plain functions the host uniquely owns, callable outside render, each with a sane fallback when absent; render-resident (hook-shaped) capabilities remain with the adapter. First consumer: `@expressive/router`'s deferred navigation (next release).
