---
"@expressive/mvc": patch
"@expressive/router": minor
---

fix: keep overridden `render` valid as JSX when consuming built packages

When `@expressive/router` was consumed as a built package (outside the monorepo), `<Route>`, `<Link>`, and `<NavLinks>` failed type-checking as JSX (`TS2786`). Their `render` overrides had no explicit return type, so the `.d.ts` emitter baked the host-seam alias's build-time fallback (`unknown`) into the published types, which is not assignable to `ReactNode`.

Two changes fix this:
- `@expressive/router`: the overridden `render` methods are annotated `: Component.Node`, so the emitter preserves the deferred alias by reference and it re-resolves to the host node type (e.g. `ReactNode`) in a consumer.
- `@expressive/mvc`: `Component.Node` now falls back to `any` instead of `unknown`. `any` is the only fallback assignable to every host's node type, so an un-annotated `render` override in any host-agnostic package still emits a JSX-valid return.
