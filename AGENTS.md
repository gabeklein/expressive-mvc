# AGENTS.md

Contributor guide for AI agents working in this repository.

## Overview

Expressive State - class-based reactive state management library.

- `@expressive/state` - framework-agnostic core
- `@expressive/react` - React adapter (primary)
- `@expressive/preact` - Preact adapter
- `@expressive/solid` - Solid adapter (not published yet)

Monorepo: pnpm workspaces + lerna.

## Structure

```
packages/state  - Core primitives
packages/react  - React adapter (.use, .get, Component, Provider)
packages/preact - Preact adapter
packages/solid  - Solid adapter
docs/llm/       - Topic-specific reference docs (see below)
```

## Reference Docs

Detailed API docs in `docs/llm/`. Each file is self-contained - fetch only what you need.

> **Read these first.** These docs cover API surface, types, lifecycle, and patterns comprehensively. Consult the relevant file before reading source.

### State (core)

- `state/state.md` - State class, reactivity, child states, methods, statics, context
- `state/get.md` - `state.get()` method overloads
- `state/set.md` - `state.set()` method overloads
- `state/lifecycle.md` - Lifecycle phases, teardown, effects, error handling
- `state/types.md` - Type aliases (`State.Extends`, `State.Field`, etc.)

### Instructions

- `instructions/get.md` - Context lookup instruction
- `instructions/set.md` - Computed, factory, validation instruction
- `instructions/ref.md` - Mutable references instruction
- `instructions/def.md` - Custom instruction primitive

### React

- `react/react.md` - React adapter: State.use(), .get(), Provider, JSX
- `react/component.md` - Component class, subcomponents, error boundaries
- `react/patterns.md` - Common recipes and examples

### Other

- `bootstrap.md` - Drop-in snippet for consumer CLAUDE.md/AGENTS.md
- `solid.md` - Solid adapter docs

## Commands

```bash
pnpm install        # Install deps
pnpm test           # Run all tests
pnpm test:watch     # Watch mode
pnpm build          # Build all packages
pnpm clean          # Clean artifacts
pnpm push           # Publish packages
```

Per-package: `tsc --noEmit && vitest run --coverage`

## Testing

Runner: **Vitest** with `jsdom` environment. Coverage target: 100%.

```ts
// packages/state tests import from local vitest re-export
import { vi, describe, it, expect, mockPromise, mockWarn, mockError } from '../../vitest';

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
- New major features need `docs/llm/` docs.

## Guardrails

- Don't modify `packages/state` to fix React-only concerns - use adapter packages.
- Don't lower coverage thresholds or skip tests.
- Don't introduce framework-specific imports in `packages/state`.
- Instructions (`def`, `ref`, `get`, `set`) are re-exported from adapters - don't duplicate implementations.
- `new()` lifecycle hook is optional; don't add it unnecessarily.
- Event dispatch is batched via `queueMicrotask()` - not synchronous.
- `State.new()` constructs + activates; plain `new State()` doesn't dispatch ready.
