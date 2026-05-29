# PLAN: Extract agnostic `Component` → `@expressive/component`

> Transitional branch plan. Living doc; delete near merge, migrating content into
> the PR summary + changeset. See AGENTS.md "Change flow".

## Goal

`Component` lives in `@expressive/react` but is React-coupled. Extract its
renderer-agnostic essence into a new package so that router, a planned
`@expressive/ui` (shadcn-style library), and `@expressive/dev` can build on it
without inheriting React. This is the first step toward consolidating the core as
`@expressive/mvc` (Model + View-Model).

## Target package graph (north star)

```
@expressive/mvc      Model + Component + instructions, renderer-agnostic   (state + component consolidated, renamed)
@expressive/react    adapter: injects React renderer
@expressive/preact   adapter
@expressive/solid    adapter (gains a real Component)
@expressive/web      adapter + own reconciler (from base principles)
@expressive/app      adapter (native)
@expressive/router   built on the agnostic Component
@expressive/style    CSS DSL (was /jsx)
@expressive/dev      meta-framework runtime
@expressive/ui       component library on the agnostic Component
```

## This branch's scope

Stand up a **transitional, private** `@expressive/component` and move the neutral
essence of `Component` into it, leaving all React realization in `@expressive/react`.
`@expressive/react`'s public surface stays byte-for-byte identical (re-exports
`Component`), so router and the website are unaffected.

`@expressive/component` is the larva of `@expressive/mvc`: it starts component-only,
later absorbs the `@expressive/state` core and is renamed. It is **not** a permanent
third package.

Out of scope (later branches): mvc consolidation/rename, `@expressive/web`, canonical
elements, giving Solid a real Component, router repo migration.

## Key decisions

- **Naming:** `@expressive/state` keeps its accurate name (the Model). "mvc" returns
  as the family/umbrella and the eventual headline package. New package is
  `@expressive/component` for now.
- **Topology:** `State` and `Component extends State` are agnostic. The adapter
  augments **both** - `State` with static hooks (`use`/`get`), `Component` with the
  render contract (`Node` type + mount + subcomponent realize + React-JSX compat).
- **Carve principle:** lift the *capability/concept* (suspense, boundary, async,
  function-components, lifecycle), never React's *shape/mechanism* (hooks composition,
  thrown-promise suspense, `ErrorBoundary` class, `createElement`). Mechanism stays
  in the adapter.
- **Guardrail:** `@expressive/component` has no `react` dep and no `jsx` in tsconfig.
  Anything that won't compile without React is, by definition, adapter realization
  (the compiler is the oracle for the seam).
- **StrictMode double-construct dedup** (`PENDING`/`SNAPSHOT`) stays in `/component` -
  it compiles agnostic and may be needed by `/web` too; revisit when `/web`'s
  construction model is known.

## Seams (how the adapter completes the class)

Three channels, chosen by call direction:

| Channel | Declared by | Called by | Examples |
|---|---|---|---|
| **Seam** (module singleton, mirror `Runtime`) | `/component` | `/component` calls adapter (IoC) | `realize`, `onConstruct` |
| **Prototype attach** | adapter mutates imported class | host runtime calls it | `bootstrap` (context-setter), `isReactComponent`, compat shims, `ErrorBoundary` |
| **Type augmentation** | `/component` declares empty target | compiler only | `Host.node` |

- `Host` = per-adapter interpretation manifest. `node` (render return type) is member
  one; canonical elements slot in later (will also need a value registry, not just
  types). `type Node = Host extends { node: infer T } ? T : unknown`.
- `realize(render, owner)` - turn a subcomponent render fn into a live host component
  (the one React line in subcomponent discovery).
- `onConstruct(instance)` - let the host claim bookkeeping fields post-`super`
  (React's `_reactInternals` etc.).

## Steps

- [x] Scaffold `packages/component` (package.json/tsconfig/tsdown/bunfig/test.setup), private, no react dep
- [x] `src/host.ts` - `Host` interface + `Node` type seam
- [ ] `src/component.ts` - class skeleton + neutral types + `PENDING`/`SNAPSHOT` reconciliation + subcomponent **discovery** + `realize`/`onConstruct` seam declarations
- [ ] Rewrite `packages/react/src/component.ts` - import `Component` + seams from `@expressive/component`; augment `Host.node = ReactNode`; fill `realize`/`onConstruct`; prototype-attach `bootstrap`/`isReactComponent`/compat shims/`ErrorBoundary`; re-export `Component`
- [ ] Add `@expressive/component` to `@expressive/react` deps
- [ ] Move/port the relevant `component.test.tsx` neutral cases into `/component`; keep React realization cases in `/react`

## Validation

- `@expressive/component`: `tsc --noEmit` + `bun test` (neutral logic only, no DOM)
- `@expressive/react`: full `tsc --noEmit && bun test --coverage` - **primary regression gate** (public surface must be unchanged)
- `@expressive/router`: bun suite as a downstream cross-check (needs the bun-test
  migration; not on `main` base - rebase or merge `feature/router` to run it)

If the mount flow shifts at all (StrictMode double-invoke, props reconciliation),
stop and surface it - do not brute-force.
