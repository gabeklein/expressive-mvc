# Plan: @expressive/preact parity with @expressive/react

## Scope

Bring `packages/preact` to feature parity with `packages/react`. The preact
adapter already reuses `@expressive/react/state` (State.use / State.get / use)
and rebinds `Runtime` hooks to `preact/compat`. Remaining gaps are at the edges.

## Work items

1. **Provider API** (`packages/preact/src/context.ts`)
   - Port React's Provider: `is` callback (replaces legacy `forEach`),
     rest-prop assignment onto the provided instance, `fallback`/`name`
     Suspense wiring (Suspense from `preact/compat`).
   - Rename `Lookup` to `Layers`, default value `Context.root` - mirror React.
   - Use shared `useHook` for context lifecycle (StrictMode-safe pattern).

2. **Component class bridge** (`packages/preact/src/component.ts`, new)
   - Port `packages/react/src/component.ts` to preact/compat.
   - Preact identifies class components via `prototype.render` (not
     `isReactComponent`), so a prototype `render` stub is required.
   - Intercept preact's instance-assigned internals (`__v`, `__d`, `__h`,
     `_sb`, `__s`, `__n`, `__P`, `__e`, `base`, `componentWillUnmount`) the
     same way React's adapter intercepts `updater`/`refs`/`_reactInternals`,
     so they stay non-enumerable and out of observed state.
   - ErrorBoundary via preact/compat class component
     (`getDerivedStateFromError` + `componentDidCatch` are supported).

3. **Export surface** (`packages/preact/src/index.ts`)
   - Mirror `packages/react/src/index.ts` exactly: add `hot`, `Component`,
     `Context`, `Observable`, etc.

4. **Shared runtime helpers** (`packages/react/src/state.ts`)
   - Re-export `useFactory`, `useHook`, `useReady` alongside `Runtime` so the
     preact adapter consumes the single implementation (per guardrail: no
     duplicated implementations).

5. **package.json**
   - `@expressive/mvc` and `@expressive/react` deps -> `workspace:^`.
   - `private: true` stays (publishing is a maintainer decision).

6. **Tests**
   - Port react suites (`context`, `state`, `use`, `component`, `runtime`)
     to `@testing-library/preact`, replacing the thin existing suites.
   - Preact `StrictMode` is an alias of `Fragment` (no double-invocation), so
     strict-mode-specific assertions are adapted to single-invocation or
     skipped with an explanatory comment.

## Validation

- `cd packages/preact && tsc --noEmit && bun test` passes.
- `cd packages/react && bun test` still passes (no regression).
