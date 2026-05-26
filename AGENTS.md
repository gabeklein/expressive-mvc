# AGENTS.md

Contributor guide for AI agents working in this repository.

## Overview

Expressive State - class-based reactive state management library. For API reference, read [skills/SKILL.md](skills/SKILL.md) and linked sub-files first. Consult source only when docs are insufficient.

Monorepo: bun workspaces + lerna. Tests and lerna run under node (vitest is not yet compatible with the bun runtime); install is via bun.

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
bun install         # Install deps
node --run test     # Run all tests (vitest under node)
node --run build    # Build all packages (lerna under node)
```

Per-package: `tsc --noEmit && vitest run --coverage`

## Testing

Runner: **Vitest** with `jsdom` environment. Coverage target: 100%.

```ts
// packages/state tests import from local vitest re-export
import {
  vi,
  describe,
  it,
  expect,
  mockPromise,
  mockWarn,
  mockError
} from '../../vitest';

// packages/react tests also get @testing-library/react
import { render, renderHook, act, waitFor, screen } from '../../vitest';
```

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
- Don't lower coverage thresholds or skip tests.
- Don't introduce framework-specific imports in `packages/state`.
- Instructions (`def`, `ref`, `get`, `set`) are re-exported from adapters - don't duplicate implementations.
- `new()` lifecycle hook is optional; don't add it unnecessarily.
- Event dispatch is batched via `queueMicrotask()` - not synchronous.
- `State.new()` constructs + activates; plain `new State()` doesn't dispatch ready.
