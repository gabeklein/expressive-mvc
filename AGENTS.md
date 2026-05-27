# AGENTS.md

Contributor guide for AI agents working in this repository.

## Overview

Expressive State - class-based reactive state management library. For API reference, read [skills/SKILL.md](skills/SKILL.md) and linked sub-files first. Consult source only when docs are insufficient.

Monorepo: bun workspaces + lerna release tooling. Install and builds run under bun (`bun install`, `bun run build`); tests are orchestrated by lerna but run package scripts under bun.

## Structure

```
packages/state  - Core primitives (@expressive/state)
packages/react  - React adapter (@expressive/react)
packages/preact - Preact adapter (@expressive/preact)
packages/solid  - Solid adapter (@expressive/solid)
skills/         - API reference docs (also published as skills.sh skill)
```

## Commands

```bash
bun install              # Install deps
bun run test             # Run package test scripts (type check + bun test)
bun run build            # Build all packages
```

Per-package: `tsc --noEmit && bun test --coverage`

## Testing

Runner: **`bun test`** with happy-dom preloaded globally for DOM tests. Coverage target: 100% lines/functions/statements (branch threshold not enforced - bun coverage doesn't support per-branch gating).

```ts
// packages/state tests import from local bun:test re-export
import {
  vi,
  describe,
  it,
  expect,
  mockPromise,
  mockWarn,
  mockError
} from '../../test';

// packages/react / packages/preact tests also get @testing-library/{react,preact}
import { render, renderHook, act, waitFor, screen } from '../../test';
```

`vi.fn` / `vi.spyOn` are shimmed over `bun:test`'s `mock` / `spyOn` so existing test idioms continue to work. The per-package `test.ts` files are the single indirection point.

### Known bun:test gaps (see SKIP comments in tests)

- Inter-file pollution in `packages/react`: bun runs all test files in one process; vitest spawned a worker per file. ~7 tests pass in isolation but fail when other react files run first.
- React 19 Suspense + happy-dom: 3 error-boundary tests in `component.test.tsx` don't render the suspended fallback under bun's scheduling.

### Custom Matchers

```ts
await expect(state).toHaveUpdated();
await expect(state).toHaveUpdated('foo', 'bar');
await expect(state).not.toHaveUpdated();
```

### Test Utilities

- `mockPromise<T>()` - controllable promise with `.resolve()` / `.reject()`
- `mockWarn()` / `mockError()` - spy on console, auto-clear between tests

### Naming Convention

- Positive: `it('will create instance')`
- Negative: `it('will not trigger update')`
- Error: `it('will throw if not found')`

## Conventions

- Framework-agnostic logic belongs in `packages/state`.
- React changes must stay aligned across `packages/react/src/{state,component,context}.{ts,test.tsx}`.
- Update tests alongside behavioral/type changes - tests must fail without the change.
- New major features need `skills/` docs.

## Guardrails

- Don't modify `packages/state` to fix React-only concerns - use adapter packages.
- Don't lower coverage thresholds or skip tests (the existing `it.skip` entries are documented bun:test gaps - leave them).
- Don't introduce framework-specific imports in `packages/state`.
- Instructions (`def`, `ref`, `get`, `set`) are re-exported from adapters - don't duplicate implementations.
- `new()` lifecycle hook is optional; don't add it unnecessarily.
- Event dispatch is batched via `queueMicrotask()` - not synchronous.
- `State.new()` constructs + activates; plain `new State()` doesn't dispatch ready.
