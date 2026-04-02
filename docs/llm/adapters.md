# Framework Adapters — Expressive State

## Package Overview

| Package              | Status    | Version |
| -------------------- | --------- | ------- |
| `@expressive/state`  | Published | 0.73.x  |
| `@expressive/react`  | Published | 0.74.x  |
| `@expressive/preact` | Private   | 0.71.x  |
| `@expressive/solid`  | Private   | 0.71.x  |

## React (`@expressive/react`)

Full-featured adapter. See `react/react.md` for documentation.

## Preact (`@expressive/preact`)

Thin wrapper over the React adapter. Identical but uses preact/hooks under the hood.

**API surface is identical to React.** Same `.use()`, `.get()`

Has its own Provider/Consumer using Preact's context API. Does not yet support Component State.

## Solid (`@expressive/solid`)

Standalone implementation - does NOT depend on React adapter. Experimental, subject to change.

See `solid.md` for documentation.
