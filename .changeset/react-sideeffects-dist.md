---
"@expressive/react": patch
---

fix: preserve adapter side-effect modules in the published build

`@expressive/react`'s `sideEffects` field listed only `jsx-runtime.ts`, so the
bundler treated the other side-effect-only imports in `adapter.ts`
(`state.get.ts`, `state.use.ts`, `component.ts`) as dead and dropped them from
the emitted dist.

The most visible casualty was `component.ts`, which installs the `context`
property setter (`bootstrap`) on `Component.prototype`. When React instantiates
an mvc Component as a class and assigns `this.context`, that setter is what
activates state - resolving `set()` field instructions into reactive getters and
swapping in the adapter's reactive render wrapper. Missing from dist, the
assignment was a no-op: state never activated, `set()` fields stayed as raw
`Symbol(field-…)` instructions, and React called `render` on the bare instance
(e.g. `this.router.segment is not a function`). `State.get` / `State.use` were
also silently absent from the published build.

This only affected consumers of the published packages; the examples alias to
`src`, where the imports always execute. Adding the three modules to
`sideEffects` keeps them in the build.
