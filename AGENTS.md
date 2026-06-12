# AGENTS.md

Contributor guide for AI agents working in this repository.

## Overview

Expressive MVC - class-based reactive state management library. For API reference, read [skills/SKILL.md](skills/SKILL.md) and linked sub-files first. Consult source only when docs are insufficient.

Monorepo: bun workspaces + changesets. Install, tests, and builds run under bun (`bun install`, `bun test`, `bun run build`). Builds on CI run under node (`node --run build`).

## Structure

```
packages/mvc    - Core primitives (@expressive/mvc)
packages/react  - React adapter (@expressive/react)
packages/preact - Preact adapter (@expressive/preact)
packages/solid  - Solid adapter (@expressive/solid)
skills/         - API reference docs (also published as skills.sh skill)
```

## Commands

```bash
bun install              # Install deps
bun run test             # Run package test scripts (type check + bun test)
bun run build            # Build all packages (bun --filter, dependency order)
```

Per-package: `tsc --noEmit && bun test --coverage`

## Testing

Runner: **`bun test`** with happy-dom preloaded globally for DOM tests. Coverage target: 100% lines/functions/statements (branch threshold not enforced - bun coverage doesn't support per-branch gating).

```ts
// Test primitives come directly from bun:test
import { mock, spyOn, describe, it, expect } from 'bun:test';

// Per-package test.setup.ts exports custom matchers + helpers
import { mockPromise, mockWarn, mockError } from '../test.setup';

// packages/react / packages/preact tests use @testing-library directly
import { render, screen, act } from '@testing-library/react';
```

Use `mock()` for `vi.fn()` equivalents and `spyOn(...)` for spies. No compat shim - `bun:test`'s primitives are used directly.

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

- Framework-agnostic logic belongs in `packages/mvc`.
- React changes must stay aligned across `packages/react/src/{state,component,context}.{ts,test.tsx}`.
- Update tests alongside behavioral/type changes - tests must fail without the change.
- New major features need `skills/` docs.
- Merged code carries essentially no comments. Add explanatory comments freely while building a feature, but strip them before committing. Keep one only when the code is genuinely cryptic and would otherwise be misread - this should be rare. Never commit narration of what the code does or why a step exists; the code and commit message carry that.

## Change flow

- When starting actual work, switch from any agent-scratch branch (`claude/*`) to a conventional named branch (`feat/...`, `fix/...`, `chore/...`) before the first real commit.
- New features and non-trivial refactors begin with a root `PLAN.md` as the branch's first commit, capturing agreed scope, key decisions, and approach before implementation.
- Keep `PLAN.md` current as the plan evolves. Close to merge, delete it and migrate its content into the PR summary and changeset entries.
- Write a changeset (`bun run changeset`) when a change is user-facing: new feature, behavior change, API addition, breaking change.
- No changeset for internal refactors, test-only changes, or fixes with no observable effect. PRs may legitimately carry zero changesets.

### Releasing

- Only `@expressive/mvc` and `@expressive/react` are published; `preact` and `solid` are private and ignored by changesets.
- Merged changesets accumulate on `main`; CI maintains a "Version Packages" PR (`changeset version`). Merging that PR triggers `changeset publish` from CI. No local publishing.

## Guardrails

- Don't modify `packages/mvc` to fix React-only concerns - use adapter packages.
- Don't lower coverage thresholds or skip tests (remaining `it.skip` / `it.todo` entries predate the toolchain migration and document known gaps unrelated to the runner).
- Don't introduce framework-specific imports in `packages/mvc`.
- Instructions (`def`, `ref`, `get`, `set`) are re-exported from adapters - don't duplicate implementations.
- `new()` lifecycle hook is optional; don't add it unnecessarily.
- Event dispatch is batched via `queueMicrotask()` - not synchronous.
- `State.new()` constructs + activates; plain `new State()` doesn't dispatch ready.
