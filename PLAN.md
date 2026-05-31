# PLAN: Agnostic `Component` → consolidated into `@expressive/state`

> Transitional branch plan. Living doc; delete near merge, migrating content into
> the PR summary + changeset. See AGENTS.md "Change flow".

## Goal

`Component` lived in `@expressive/react` but was React-coupled. Distill its
renderer-agnostic essence so router, a planned `@expressive/ui` (shadcn-style
library), and `@expressive/dev` can build on it without inheriting React. This is
a step toward consolidating the core as `@expressive/mvc` (Model + View-Model).

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

## What this branch did

The plan originally stood up a **transitional, private** `@expressive/component`
package. That package did its job - it proved the agnostic boundary holds with no
runtime coupling - and was then **folded directly into `@expressive/state`** rather
than kept as a standalone artifact. The intermediate package no longer exists.

Outcome:

- `Component` (+ `Host`/`Node`, `Props`/`StateProps`) now lives in `@expressive/state`
  as a layer on `State`, exported from its index. `Component depends only on State`,
  so it was never a peer package - just a layer that didn't need its own build target.
- `@expressive/react` is a pure adapter: it imports `Component` from `@expressive/state`
  and completes it via type augmentation + prototype attach + a `Component.on` hook.
- `@expressive/react`'s public surface is unchanged (still re-exports `Component`), so
  router and the website are unaffected.

The `@expressive/mvc` rename (renaming `@expressive/state` once it is the consolidated
core) is **deferred to a release-time PR** - it touches every `@expressive/state`
importer and shouldn't be entangled with active shaping.

Out of scope (later branches): the mvc rename, `@expressive/web`, canonical elements,
giving Solid a real Component, router repo migration.

## Key decisions

- **No standalone `/component` package.** It was transitional only; its contents are
  now part of `@expressive/state`. "mvc" returns later as the renamed core.
- **Topology:** `State` and `Component extends State` are agnostic and co-located in
  `@expressive/state`. The adapter augments **both** - `State` with static hooks
  (`use`/`get`), `Component` with the render contract (`Node` type + mount + React-JSX
  compat).
- **Carve principle:** lift the *capability/concept* (suspense, boundary, async,
  function-components, lifecycle), never React's *shape/mechanism* (hooks composition,
  thrown-promise suspense, `ErrorBoundary` class, `createElement`). Mechanism stays in
  the adapter.
- **Subcomponents are an adapter feature, not core.** Capitalized-member → owner-bound
  subcomponent presumes a coarse-re-render host (bind a render fn, re-invoke on change) -
  a React-family assumption that doesn't port to fine-grained (Solid/Svelte) or
  retained-mode hosts. The walk now lives in `@expressive/react`, calling `useHook`/`watch`
  directly. No seam survives - the adapter imports only `Component`.
- **StrictMode dedup is detection-only.** Core keeps `PENDING` + `return copy` (collapse
  the double-construct onto one instance) - a host-agnostic identity check. The former
  snapshot/restore handshake (re-applying accessors clobbered by a subclass class-field
  replay) was **removed** as inert: it guarded a fix-era bun-runtime quirk where the
  deduped instance was already reactive at the second construct. Under the current runtime
  (and matching real React), both constructs complete *before* `State` init installs
  accessors, so nothing live exists to clobber. Locked in by StrictMode construct/init
  ordering tests in `@expressive/react`.

## Seams (how the adapter completes the class)

No module-singleton seams, no IoC. The adapter completes the class through:

| Channel | Declared by | Called by | Examples |
|---|---|---|---|
| **`Component.on` hook** | adapter registers via state's public event API | state runs it per-instance | wire subcomponent discovery (`subcomponents(self)`, adapter-local) |
| **Prototype attach** | adapter mutates imported class | host runtime calls it | `bootstrap` (context-setter), `isReactComponent`, internals carve-out, compat shims, `ErrorBoundary` |
| **Type augmentation** | core declares empty target | compiler only | `Host.node`, `Component` JSX compat members, `Component.contextType` |

- `Host` = per-adapter interpretation manifest. `node` (render return type) is member
  one; canonical elements slot in later. `type Node = Host extends { node: infer T } ? T : unknown`.
- The internals carve-out (`updater`/`refs`/`_reactInternals`/`_reactInternalInstance`)
  is installed once as setter-only accessors on `Component.prototype`; an instance only
  materializes a non-enumerable own property if React actually assigns one.

## Steps

- [x] Scaffold transitional `packages/component`, private, no react dep
- [x] `host.ts` - `Host` interface + `Node` type seam
- [x] `component.ts` - class skeleton + neutral types + `PENDING` dedup detection + props reconciliation
- [x] Rewrite `packages/react/src/component.ts` as a pure adapter (augment `Host.node`,
      prototype-attach `bootstrap`/`isReactComponent`/compat/`ErrorBoundary`, re-export)
- [x] Eliminate the `onConstruct`/`realize`/`restore` module-singleton seams
- [x] Move subcomponent discovery into `@expressive/react` (adapter-family feature)
- [x] Fold `@expressive/component` into `@expressive/state`; delete the package
- [x] Remove the inert StrictMode dedup restore handshake; keep detection only, add construct/init ordering tests

## Validation

- `@expressive/state`: `tsc --noEmit` + `bun test` (now hosts the agnostic Component)
- `@expressive/react`: full `tsc --noEmit && bun test --coverage` - **primary regression
  gate** (public surface must be unchanged)
- `@expressive/router`: bun suite as a downstream cross-check (needs the bun-test
  migration; not on `main` base)

If the mount flow shifts at all (StrictMode double-invoke, props reconciliation),
stop and surface it - do not brute-force.
