# CLI Adapter (experiment)

> `@expressive/cli` is a private, unpublished experiment (`packages/cli`). It records the first standalone renderer built on core - no React, no framework underneath.

### Key difference: it owns the reconciler

React and Preact adapters delegate element reconciliation to their host framework. `@expressive/cli` is its own `jsxImportSource`: it registers a host with `@expressive/mvc/jsx-runtime`, defines its own element objects, and maintains a live slot tree that maps elements to persistent Component instances.

```tsx
/* tsconfig: "jsxImportSource": "@expressive/cli" */
import { Component, render } from '@expressive/cli';

class Timer extends Component {
  elapsed = 0;

  new() {
    const timer = setInterval(() => this.elapsed++, 1000);
    return () => clearInterval(timer);
  }

  render() {
    return `elapsed: ${this.elapsed}s`;
  }
}

render(<Timer />);
```

### Architecture

Two halves, deliberately separable:

- **Instance reconciler** (`render.ts`) - host-agnostic in principle; the seed of any future standalone renderer (`/web`, `/app`). Elements resolve to slots; class components construct once and persist, each driven by its own `watch` effect. Children match by key (else index) and type; matched component slots receive new props by assignment, which core merges into state. Unmatched slots tear down - popping a component's context destroys its instance.
- **Terminal backend** (`terminal.ts`) - frame = plain string. Repaint erases the previous frame's lines (ANSI) and rewrites. Identical frames skip. Non-interactive output writes only the final frame at unmount.

### What core already provided

- Element pragma seam (`host()` registration, agnostic `Fragment`, `Host` type manifest)
- Per-instance invalidation (`watch`) and microtask batching
- Suspense semantics: a thrown Promise inside `watch` defers and retries; the renderer shows `fallback` meanwhile
- `catch` + `fallback` error recovery contract
- Context tree (`push` / `set` / `pop`) with instance lifecycle tied to it

### Renderer-specific learnings

- **`capture` is load-bearing**: a `watch` created inside another `watch`'s callback registers with the parent effect and dies on its re-render. The reconciler wraps child mounting in `capture()` since slot teardown is owned by the renderer, not the parent effect.
- `get(Type)` (instruction) is the context pattern that works in fields; `this.get(Type)` resolves during construction, before the instance is registered.
- Suspense promises must be rethrown as settle-only derivatives (`err.then(noop, noop)`) so instance destruction doesn't leak an unhandled rejection through `watch`'s retry.

### Not yet supported (by design, MVP)

- No intrinsic tags - `JSX.IntrinsicElements` is `{}`; components and text only. Layout is line-based via `\n` in strings.
- No suspense bubbling: `fallback: false` renders nothing rather than deferring to an ancestor boundary.
- No rendering of Component *instances* as children (react adapter's `$$typeof` path).
- No input handling or focus management.
- No capitalized-method subcomponents.
- Errors thrown by async updates with no boundary are lost to the dispatch loop's `console.error`.
