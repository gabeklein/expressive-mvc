# Expressive MVC – AI Contributor Notes
**Repo Snapshot**
- Monorepo managed by pnpm workspaces + lerna (see package.json, pnpm-workspace.yaml); source lives in packages/*, runnable examples in examples/*.
- Core engine @expressive/mvc defines the reactive Model runtime (packages/mvc/src/**); framework adapters (react, preact, solid) wrap it for specific UI libraries.
- Tests target only mvc and react today (root jest.config.json); moduleNameMapper rewires @expressive/* to local src for cross-package imports during tests.

**Core Model**
- Model instances track state via WeakMaps in packages/mvc/src/model.ts (STATE, METHOD, PARENT, NOTIFY); modifying these maps affects lifecycle and must stay in sync with prepare/init logic.
- createEffect/addListener/event in packages/mvc/src/control.ts orchestrate async-safe change propagation; every new side effect should go through these helpers rather than manual listener wiring.
- Model.set is heavily overloaded: when used with no args it exposes pending updates (PromiseLike), when given callbacks it registers listeners; leverage existing overloads instead of branching on typeof manually.
- Instructions under packages/mvc/src/instruction (use, set, get, has, ref) rely on Model.on(init) to rewrite property descriptors; new instructions should plug in through use(...) rather than mutating models directly.

**Context & Composition**
- packages/mvc/src/context.ts maintains hierarchical Contexts with push/pop, include, has; registration order matters because push() clones the parent and pop() runs cleanup callbacks.
- get(Type) resolves parent-owned models via Context.get and PARENT mappings; expectParent=true will throw when the hierarchy is wrong, so tests should cover both success and error paths.
- has() wires child discovery callbacks through APPLY/Context.has; ensure callbacks return cleanup functions that respect enter()/flush sequencing from control.ts.

**React Adapter**
- packages/react/src/index.ts seeds Hook.useState/useEffect so Model.use can stay framework-agnostic; any new adapter must provide compatible Hook implementations.
- Model.use (packages/react/src/model.use.ts) keeps a Context per component tree, supports assign/callback modes, and can reapply props when repeat=true; reuse this pathway instead of instantiating models in JSX manually.
- Model.get in React wraps createEffect with a ForceRefresh helper, enabling suspense-aware selectors and explicit refresh scheduling.
- jsx-runtime.ts swaps React Runtime.jsx/jsxs through compat() so Model subclasses can be rendered directly; when extending rendering behavior, update METHOD bindings instead of touching Runtime.

**Testing & Tooling**
- Run pnpm install once, then pnpm test to execute lerna-run test across packages; use pnpm --filter @expressive/react test for a focused run.
- Jest uses @swc/jest with 1s timeout and 100% coverage gates (packages/*/jest.config.json); missing coverage will fail CI, so add tests alongside new code.
- packages/mvc/jest.setup.js and packages/react/jest.setup.js register custom matchers (toUpdate, toHaveUpdated); rely on Model.set() returning a promise to assert update timing.
- Build artifacts come from tsup configs in each package (dist + dist/esm split); exports rely on these layouts, so keep entry lists aligned with new source files.

**Implementation Tips**
- Derive new computed properties through get(...) factories or set(...) descriptors; they automatically hook into dependency tracking and Suspense.
- When adding async flows, prefer set(factory, callback) so Suspense and flush semantics stay intact; wrap long chains with enter()/flush if manual scheduling is needed.
- Context providers should be created via createProvider (packages/react/src/context.ts) to guarantee consistent Suspense boundaries and cleanup.
- Examine packages/react/src/model.use.test.tsx and packages/mvc/src/instruction/*.test.ts for patterns on testing lifecycle edge cases before adding new scenarios.
