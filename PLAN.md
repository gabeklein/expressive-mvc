# Plan: Solid adapter parity (`@expressive/solid`)

Bring `packages/solid` from proof-of-concept to reasonable parity with
`packages/react`, implemented idiomatically for Solid (signals, onCleanup,
useContext - no Suspense-by-thrown-promise).

## Scope

1. **`State.use` context participation** - create instance with `new this(init)`
   (not `this.new`), push onto ambient context via `useContext(Lookup)` so the
   `get()` instruction resolves parents/peers; `context.pop()` +
   `instance.set(null)` on `onCleanup`. Support constructor args / assign
   objects and the `use()` interception protocol, invoked once at setup
   (Solid components do not re-render, so per-render re-invocation is N/A).
2. **`State.get` argument forms** - `get()` (required), `get(false)` (optional,
   undefined when missing), `get(true)` (require values - accessors throw when
   value is undefined, the non-suspense analog), and
   `get((current, refresh) => value)` factory/effect form built on mvc `watch`,
   with react's `refresh` semantics. Promise-returning factories resolve to a
   signal updated when settled (null while pending, throws on rejection).
3. **Signal proxy fix** - one proxy + one persistent listener per instance,
   cached in WeakMaps; listener self-removes when instance is destroyed
   (returns `null` on terminal event). No duplicate subscriptions, no leaks.
4. **`Consumer` component** - `for` + `children` render function receiving the
   reactive proxy.
5. **`Provider` parity** - rest-prop assignment via `splitProps`, `is` callback,
   reactive prop reads inside `createComputed`.
6. **Exports** - `State` (+ default), `Context`, `Observable`, `def`, `get`,
   `ref`, `set`, `hot`, `use`, `Provider`, `Consumer`. `use(subject)` hook for
   externally-owned observables mirrors react's.
7. **Packaging** - `workspace:^` dep, `type: module`, dist-pointing
   `main`/`types`/`exports`, tsdown build, `tsc --noEmit && bun test` test
   script, bunfig/test.dom/test.setup following the react/preact pattern.
   Stays `private`.
8. **Tests** - `@solidjs/testing-library` + bun test, written in plain TS
   (`createComponent`, no Solid JSX transform under bun): use() lifecycle,
   get() argument forms, fine-grained reactivity, Provider/Consumer, context
   parent-child via `get()` instruction, proxy dedupe.

## Out of scope

- Suspense integration (async modeled with signals instead).
- `Component` class bridge.
- HMR `hot` semantics beyond the plain `hot()` re-export from mvc.
- Re-attaching `State.get` when a Provider swaps the instance mid-lifetime
  (react re-resolves per render; Solid setup runs once).
