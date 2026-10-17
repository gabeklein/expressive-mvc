# Native app host and standalone /jsx

Reference trunk: a second host for the /dom renderer, proving the renderer can stand alone as `@expressive/jsx`. Both packages are private and unpublished. The NativeScript demo and device harness live in `~/Projects/expressive-app` (local repo), which also holds the spike's `REPORT.md` and screenshots.

## Packages

- **`packages/jsx` (`@expressive/jsx`):** /dom's `src` from `1e7917e56`. The vnode runtime, renderer core (reconcile, component, scheduler, suspense, collections, hot) and style-rule engine run only through an installed `Host`. Core has no runtime DOM references.
  - `src/dom` is the DOM host: node operations, props/events/SVG, controlled inputs, autofocus, sheet emitter, `css` macros, HTML/SVG tag types. It becomes /dom at extraction.
  - The copied /dom suite passes against it, and `render/host.test.tsx` runs the core against an in-memory host under `@vitest-environment node`.
- **`packages/app` (`@expressive/app`):** the NativeScript host over `@nativescript/core` views.
  - Elements are `View`s, so refs get views. Text, markers and fragments are virtual nodes, and layout children sync by index.
  - Tags are class names with a lowercase first letter (`stackLayout`, `label`, `button`). Events are `on` + the NativeScript event name.
  - `run(node)` mounts on a `GridLayout` root. `@expressive/app/webpack`'s `expressive(webpack)` adds TSX and a `post` HMR loader that ports /dom's `vite.ts` to `module.hot`.
  - Verified on the iOS simulator: Model updates, `map` rows, a lazy component under `fallback`, `style()` rules, and HMR keeping state across render/method/style edits.

## Host interface

```ts
interface Host<N extends object = any> {
  element(tag: string, parent: N): N; text(value: string): N; marker(label: string): N; fragment(): N;
  insert(parent: N, node: N, before: N | null): void; remove(node: N): void;
  parent(node: N): N | null; next(node: N): N | null; root(node: N): N;
  clear(container: N): void; setText(node: N, value: string): void; target(into: unknown, parent: N): N;
  prop(element: N, key: string, previous: unknown, next: unknown): void;
  style(element: N, previous: Claim | undefined, next: Claim): void;
  raw?: string; deferred?: readonly string[];
  created?(element: N, props: Record<string, any>): void;
  settle?(element: N, next: Record<string, any>, previous: Record<string, any>): void;
  release?(element: N): void; flush?(): void;
}
```

It's installed with `install(host)`, a module-level singleton, and takes the shape of Vue's `nodeOps`. Fibers stay marker ranges, so the core logic is unchanged.

## Core changes beyond swapped calls

These are what /dom takes at extraction:

1. **`claim()` takes no element.** It returns `classes: (string | { block, depth })[]`. The host emits classes (DOM) or merges declarations in `(depth, ordinal)` order under inline style (native).
2. **`registerEmitter`/`emitClass` are removed from `style/protocol.ts`.** The host is the emitter.
3. **Event bookkeeping, controlled-input restore and the autofocus queue moved into the DOM host.** Fiber dropped `events`.
4. **`ref` receives whatever `host.element` returned.**
5. **Intrinsic types are host-supplied.** An empty `Tags` interface is augmented by `dom/types.ts` and `app/tags.ts`.
6. **Open:** `style.Property` is still CSS-derived. It's the "Portable style vocabulary" board item, solvable like `Tags`.

## Agreed shape

- /jsx, /dom and /app live in this monorepo, so host-interface changes land atomically. The NativeScript demo and device harness (Xcode, CocoaPods, simulators) stay out of the main CI path.
- NativeScript over Expo: direct view manipulation is NativeScript's public API, while Expo's Fabric path is private. An Expo/Fabric spike also passed and is kept as the comparison point.
- Naming is provisional: "app" for now; "native", or a -web/-app pair, is open.

## Pending

- **Maintainer sign-off on public surface:** `Host`, `install()`, `Tags`, and `Claim` carrying blocks.
- **Extraction:** move `jsx/src/dom` plus /dom's `vite.ts` into /dom, rebuild /dom on /jsx, and reconcile /dom changes since `1e7917e56`.
- **`packages/app` tests** against a fake of the few `View` methods the host uses, for the 100% gate. Today its `test` is typecheck only.
- **Native work:**
  - batch child sync per pass (it's O(n²) today);
  - a native style property vocabulary and unit macro pack;
  - an Android run;
  - `ListView`-backed collections, text input, `Frame` navigation with `/router`;
  - a scripted native hot probe.

## Notes for tooling

- NativeScript needs bun's hoisted linker (`bunfig.toml`: `linker = "hoisted"`) in its app workspace.
- iOS builds need Homebrew Ruby and CocoaPods gems on `PATH`/`GEM_PATH`.
- `run()` overrides NativeScript's `__onLiveSyncCore`; otherwise every update remounts the root view.
- The entry module must declare no Model classes, so mvc's hot tracking starts before instances exist.
