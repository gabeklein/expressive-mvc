# PLAN: Agnostic JSX runtime in `@expressive/mvc` (#106)

Design proposal for the host-independent JSX pragma. Goal state: a framework-agnostic
package (router first) compiles with `jsxImportSource: "@expressive/mvc"`, imports nothing
from React, and renders under whatever host adapter the app installs. This is Gate 0 of
the router ship roadmap and the element-layer extension of the #100 "adapter completes
the class" pattern.

## Scope

1. `@expressive/mvc/jsx-runtime` (+ `/jsx-dev-runtime`): `jsx` / `jsxs` / `jsxDEV` /
   `Fragment`, delegating to an adapter-registered host runtime.
2. Element-introspection seam: `childrenOf` / `isElement` / `typeOf` / `propsOf`,
   registered alongside.
3. TypeScript: a `JSX` namespace on the runtime entry, built on the existing
   `Component.Host` / `Component.Node` augmentation seam.
4. Adapter side: `@expressive/react` registers its runtime + introspection as an import
   side effect.
5. Router migration sketch (consumer validation; the actual migration is a follow-up PR).

Out of scope (per #106 itself): concrete first-party hosts, a Solid-flavored `Component`,
the `render` proxy / host-capability negotiation (deferred - see Decisions), the classic
`createElement` pragma (deferred - see Decisions).

## Architecture

### The delegation model

`@expressive/mvc` already has two precedents this design simply unifies:

- **Value seam** - `packages/react/src/runtime.ts` exposes `Runtime = {} as {...}` whose
  slots (`createElement`, `useState`, ...) are assigned by `index.ts` at import time.
- **Type seam** - `Component.Host` is an empty interface the adapter augments
  (`interface Host { node: React.ReactNode }`), and `Component.Node` derives from it.

The JSX runtime is the same shape, hoisted into core: mvc exports thin `jsx`/`jsxs`
functions that forward to a host table; the adapter fills the table when imported.

```ts
// packages/mvc/src/jsx.ts (new)
interface HostRuntime {
  jsx(type: unknown, props: object, key?: unknown): Component.Node;
  jsxs(type: unknown, props: object, key?: unknown): Component.Node;
  jsxDEV?(type: unknown, props: object, key: unknown, isStatic: boolean, source?: object, self?: unknown): Component.Node;
  Fragment: unknown;
  childrenOf(children: unknown): Component.Node[];
  isElement(node: unknown): boolean;
  typeOf(node: unknown): unknown;
  propsOf(node: unknown): Record<string, unknown>;
}

/** Adapter registration - one host per build. */
function host(runtime: HostRuntime): void;
```

Why one `host()` call instead of slot-by-slot assignment like `Runtime`:

- Atomic - no window where `jsx` exists but `Fragment` doesn't.
- A second call with a *different* runtime throws immediately ("two adapters in one
  build"), turning a confusing render bug into a loud setup error. Same-reference
  re-registration is a no-op (HMR re-runs adapter module bodies).
- One obvious grep target for "how does an adapter bind".

`Fragment` is exported from mvc as a stable sentinel object (`const Fragment = Symbol or
frozen object`)? **No** - see Fragment note below; it must be a *getter-forwarded* host
value.

#### Fragment

`Fragment` cannot be an mvc-owned sentinel: the host reconciler receives it as an element
`type` and must recognize its own (`react.Fragment` is a registered symbol React checks
internally). So mvc's `jsx-runtime` exports a `Fragment` that resolves to the host's at
access time. ESM live bindings make this clean:

```ts
// jsx-runtime.ts
export let Fragment: unknown;          // assigned by host(); live-bound for importers
export const jsx = (type, props, key) => resolved().jsx(type, props, key);
```

Transpilers import `Fragment` at module top but only *read* it when constructing
elements, after the adapter has registered - live binding means they see the assigned
value. (Caveat verified in plan review: `jsx-runtime` output references `Fragment` lazily
per element, so import-order is only a render-time constraint, same as `jsx` itself.)

For *identity checks* (router's `node.type === Fragment`), consumers compare against the
same live binding - it equals whatever the host returned from `typeOf`, so equality holds.

### Unregistered behavior (error design)

- Importing `@expressive/mvc/jsx-runtime` is always safe - types-only consumers and
  test collection must not explode at import.
- First *call* to `jsx`/`jsxs`/introspection with no host registered throws:

  ```
  Error: No JSX host is registered for @expressive/mvc.
  Import a host adapter (e.g. '@expressive/react') before anything renders -
  typically as the first import of your application entry module.
  ```

  Named, actionable, and points at the actual fix (import ordering) since the most likely
  cause is an agnostic library module evaluating JSX at module scope before the app entry
  imported the adapter.
- `Fragment` read before registration yields `undefined`; that is tolerable because it is
  only consumed by `jsx(...)` calls which throw the real error anyway. (We could trap it
  with a getter-only module facade, but the added indirection buys nothing - the throw in
  `jsx` lands first in every real sequence.)

### Adapter registration (when and how)

In `@expressive/react/index.ts`, alongside the existing `Runtime.*` assignments:

```ts
import { Children, Fragment, isValidElement } from 'react';
import { jsx, jsxs, jsxDEV } from 'react/jsx-dev-runtime'; // see note
import { host } from '@expressive/mvc';

host({
  jsx, jsxs, jsxDEV, Fragment,
  childrenOf: (children) => Children.toArray(children),
  isElement: isValidElement,
  typeOf: (node) => isValidElement(node) ? node.type : undefined,
  propsOf: (node) => isValidElement(node) ? node.props as Record<string, unknown> : {}
});
```

- **When:** import side effect, same lifecycle as the existing `Runtime.createElement =`
  assignments and the `Component.on(subcomponents)` hook. The app already must import the
  adapter to render anything; no new requirement, just a new consequence of the import.
  This does mean `@expressive/react` is no longer `sideEffects: false`-eligible - it
  already isn't (prototype attach, `Runtime` assignment). `@expressive/mvc` itself stays
  side-effect-free.
- **dev vs prod runtime:** React ships `jsx-runtime` and `jsx-dev-runtime` as separate
  conditional entries. The adapter registers both: `jsx`/`jsxs` from `react/jsx-runtime`,
  `jsxDEV` from `react/jsx-dev-runtime` resolved lazily/optionally (mvc's
  `jsx-dev-runtime.ts` falls back to `jsx`/`jsxs` when the host registered no `jsxDEV`,
  so a prod-only host still works under a dev-transpiled consumer). Exact import strategy
  (static dual-import vs `package.json` condition mirroring) is an implementation detail
  to settle in the adapter PR; the seam supports either.

### One adapter per build

Already the documented contract of `Component.Host` ("two augmenting `node` with
different types in the same build would conflict - by design"). The runtime layer now
*enforces* what the type layer assumes: second `host()` with a different runtime throws.
Multi-host apps were never a goal; the escape hatch is separate bundles.

## Introspection seam

### What router actually needs (audit of `packages/router/src` on `feature/router`)

| Router usage | Today (react) | Proposed |
|---|---|---|
| Flatten children for lexical walk | `Children.toArray(children)` | `childrenOf(children)` |
| Skip non-elements | `isValidElement(node)` | `isElement(node)` |
| Discriminate `Route` vs `Fragment` vs other | `node.type` | `typeOf(node)` |
| Read `to`/`default`/`children` off elements | `node.props as RouteProps` | `propsOf(node)` |
| Fragment transparency in walks | `type === Fragment` | `type === Fragment` (mvc export) |

That is the complete read surface. Everything else React's element API offers stays out:

- **Out:** `cloneElement`, `createElement` re-export, `key`/`ref` access, `Children.map`
  /`count`/`only`, owner/fiber internals, portals. None are needed by router; each is a
  host-capability bet we should not generalize from one consumer. Add later if a second
  consumer demonstrates need.
- **`childrenOf` semantics:** mirrors the host's `Children.toArray` - flattens arrays and
  strips `null`/`undefined`/booleans, but does **not** see through Fragments. Router
  already handles Fragment recursion explicitly (`matchesAnywhere`, `allRoutes`) and that
  should stay visible in consumer code: fragment transparency is a *policy* (router
  chooses to treat fragments as grouping), not a primitive. Hosts also disagree on
  fragment representation; the thin contract ports better.

### Naming

- `childrenOf(x)` over `toArray` - says what it returns *and* what it takes; `toArray` is
  meaningless without React's `Children` namespace for context.
- `isElement(x)` over `isValidElement` - React's "valid" is historical ($$typeof
  forgery guard); the qualifier carries no meaning at this seam.
- `typeOf(x)` / `propsOf(x)` over raw property access - hosts disagree on element shape
  (Solid's JSX "elements" are DOM nodes/functions, Preact uses `.type/.props` like React
  but that is incidental). Function accessors keep the element opaque, which is the whole
  point of the seam. The `-Of` suffix family reads as one coherent vocabulary.
- Considered `inspect(node) => { type, props } | null` (single call, destructurable).
  Rejected: forces allocation per node in hot lexical walks, and call sites mostly need
  only one of the two.

These export from `@expressive/mvc` root (they are library-author API, not transpiler
API), while `jsx`/`jsxs`/`Fragment` live on the `jsx-runtime` entries (transpiler API).
`Fragment` additionally re-exports from root for identity checks without importing a
runtime entry.

## TypeScript story

### JSX namespace resolution

With `jsxImportSource: "@expressive/mvc"`, TS resolves JSX types from
`@expressive/mvc/jsx-runtime`'s exported `JSX` namespace:

```ts
// jsx-runtime.ts (types)
import { Component } from './component';

export namespace JSX {
  type ElementType = Component.Host extends { elementTypes: infer T } ? T
    : keyof IntrinsicElements | Component.FC<any> | (abstract new (...args: any) => Component);
  interface Element extends ... {}            // = Component.Node (see below)
  interface ElementClass extends Component {}
  interface ElementAttributesProperty { props: {} }
  interface ElementChildrenAttribute { children: {} }
  interface IntrinsicElements {}              // adapter augments
  interface IntrinsicAttributes { key?: string | number }
}
```

- **`Element`**: must equal `Component.Node`. Since `Node` is a conditional type and
  `JSX.Element` must be an interface-or-type alias TS accepts, alias works:
  `export type Element = Component.Node` inside the namespace (TS allows type aliases in
  JSX namespaces since 5.1's `JSX.ElementType` work). Before an adapter loads,
  `Element = unknown` - JSX expressions typecheck loosely but don't error, which is the
  right degenerate behavior for adapter-less typechecking.
- **`ElementClass` / `ElementAttributesProperty`**: class components are `Component`
  subclasses; attribute checking flows through the declared `props: Component.Props<this>`,
  so the existing `Props`/`StateProps`/`RenderProps` machinery applies unchanged. This is
  the payoff of #100: the JSX contract lands on a core class the adapters merely complete.
- **`IntrinsicElements`**: empty interface in core; the adapter augments. For react:

  ```ts
  declare module '@expressive/mvc/jsx-runtime' {
    namespace JSX {
      interface IntrinsicElements extends React.JSX.IntrinsicElements {}
    }
  }
  ```

  The augmentation lives in `@expressive/react`'s d.ts, so any program that *includes*
  the adapter's types gets full DOM-tag/event typing - tags, `onClick`, `href`,
  `aria-current` - expressed through React's types but accessed via mvc's namespace.

- **Component-type and node types** (replacing `ComponentType`, `ReactNode`):

  ```ts
  namespace Component {
    type FC<P = {}> = (props: P) => Component.Node;   // render-prop / `as` shapes
  }
  ```

  `Component.Node` already exists. Router's `ComponentType<{children?: ReactNode}>`
  becomes `Component.FC<{ children?: Component.Node }>` - adapter-bound through `Host`,
  so under react it is assignable from any `React.FC`.

### How router typechecks anchors/events without react *imports*

Distinguish two things the prompt conflates deliberately:

- **No react value/type imports in source** - achieved: `AnchorHTMLAttributes` and
  `MouseEvent` drop out (below).
- **No react types in the *program*** - not attempted in phase 1. Router's tests render
  under `@expressive/react` (Gate 0: "react remains test-host only"), so the adapter's
  d.ts - and with it the `IntrinsicElements` augmentation - is in the compilation anyway.
  Source files stay clean; the typechecker is host-informed. This matches the runtime
  one-host-per-build rule: typechecking is per-build too.

For the two router call sites:

- `MouseEvent` in `link.tsx`: use the **DOM lib's** `MouseEvent` (router's tsconfig has
  `lib: ["DOM"]`). The handler doesn't use React-synthetic-specific API
  (`defaultPrevented`, `button`, `metaKey`, `preventDefault` are all native). React's
  `onClick` accepts the wider native-typed handler structurally? It does not - so the
  handler is typed `(e: MouseEvent) => void` and passed to `onClick` where the adapter's
  IntrinsicElements expects `React.MouseEventHandler`; React's synthetic event is
  structurally assignable *to* the native interface for the members used. Where variance
  bites, the seam type below absorbs it.
- `AnchorHTMLAttributes<HTMLAnchorElement>` in `Link.Props`: replace with a host-derived
  lookup through the JSX namespace itself:

  ```ts
  import { JSX } from '@expressive/mvc/jsx-runtime';
  export type Props = JSX.IntrinsicElements['a'] & { to?: string; replace?: boolean };
  ```

  Under the react-augmented program this *is* `AnchorHTMLAttributes`, with zero react
  imports in source. Under no adapter it errors ('a' not in `{}`) - acceptable per the
  per-build typing rule; a host-neutral fallback is the phase-2 item below.

**Phase 2 (optional, separate issue):** a types-only `@expressive/mvc/dom` entry with a
minimal host-neutral `IntrinsicElements` derived from `lib.dom` (`HTMLElementTagNameMap`
props + native event handlers), letting agnostic packages typecheck with no adapter in
the program at all. Deliberately deferred: real consumers always have a test host, and a
parallel DOM typing universe is a maintenance tax to take on only if proven necessary.

## Package wiring

### `@expressive/mvc`

```jsonc
"exports": {
  ".":                { "types": "./dist/index.d.ts",           "default": "./dist/index.js" },
  "./jsx-runtime":    { "types": "./dist/jsx-runtime.d.ts",     "default": "./dist/jsx-runtime.js" },
  "./jsx-dev-runtime":{ "types": "./dist/jsx-dev-runtime.d.ts", "default": "./dist/jsx-dev-runtime.js" }
}
```

New sources: `src/jsx.ts` (host table, `host()`, introspection, error), `src/jsx-runtime.ts`
(`jsx`/`jsxs`/`Fragment` + `JSX` namespace), `src/jsx-dev-runtime.ts` (`jsxDEV` +
re-exports, falls back to `jsx`/`jsxs` when host registers no dev runtime). tsdown's
existing `src/**/*.ts` glob picks them up unbundled - only the exports map changes.
`sideEffects: false` is preserved (registration lives in adapters).

`index.ts` re-exports `host`, `childrenOf`, `isElement`, `typeOf`, `propsOf`, `Fragment`.

### `@expressive/react`

`index.ts` adds the `host({...})` call (import side effect, beside the existing `Runtime`
assignments). d.ts gains the `JSX.IntrinsicElements` augmentation and the
`Host.node` augmentation it already has. No exports-map change.

### Consumers (router)

`tsconfig.json`: keep `"jsx": "react-jsx"`, add `"jsxImportSource": "@expressive/mvc"`.
`package.json`: dependency shrinks to `@expressive/mvc`; `@expressive/react` + react move
to devDependencies (test host). react peerDependency dropped.

## Router migration sketch

| File | Change |
|---|---|
| `route.tsx` | `@expressive/react` -> `@expressive/mvc` (Component/get/set). `Children.toArray` -> `childrenOf` (4 sites), `isValidElement` -> `isElement` (3), `node.type` -> `typeOf(node)` (4), `node.props as X` -> `propsOf(node) as X` (4), `Fragment` -> mvc `Fragment`. `ReactNode` -> `Component.Node`, `ComponentType<...>` -> `Component.FC<...>`. `<Suspense fallback={null}>` -> a one-line `class Boundary extends Component {}` (Component's built-in `fallback` defaults to `null`, giving the same root boundary with zero react imports). |
| `link.tsx` | imports -> mvc; `AnchorHTMLAttributes<...>` -> `JSX.IntrinsicElements['a']`; `MouseEvent<HTMLAnchorElement>` -> DOM `MouseEvent`. |
| `nav.tsx` | imports -> mvc; `ReactNode`/`ComponentType` swaps as above. |
| `redirect.ts` | import swap only. |
| `router.ts`, `url.ts` | import swap only on `feature/router`. (The `feature/router-transition` branch's `useTransition`/`startTransition` usage is genuinely host-coupled and ships later per the roadmap - it will need its own seam or stays adapter-assisted.) |
| `index.ts` | unchanged. |
| `tsconfig.json` / `package.json` | as above. |
| tests | unchanged in behavior: they keep `jsxImportSource` react? **No** - tests compile under the same tsconfig, so they also emit mvc-runtime calls; importing `@expressive/react` in test setup registers the host, exercising the seam for free. |

**Estimated diff:** ~15 changed lines in `route.tsx`, ~8 in `link.tsx`, ~6 in `nav.tsx`,
~2 each in `redirect.ts`/`router.ts`, plus config - roughly **40-60 lines** across 8
files, no structural changes. The lexical-walk logic is untouched; only the vocabulary of
element inspection changes.

## Decisions and alternatives considered

1. **Runtime delegation over compile-time alias.** A bundler/tsconfig alias
   (`@expressive/mvc/jsx-runtime` -> `react/jsx-runtime`) would have zero runtime cost
   but is rejected: router *publishes compiled output* - the import specifier is baked
   into `dist`, so every downstream app would need bundler config (and unbundled
   ESM/import-map consumers have no recourse). Delegation keeps published artifacts
   genuinely host-free at ~one extra call per element - noise next to reconciliation
   cost. (A future perf escape hatch remains open: adapters *could* ship an optional
   alias recipe for apps that want to flatten the hop; the runtime path is the portable
   default, not a ceiling.)
2. **Automatic runtime only, classic `createElement` deferred.** #106 lists both; Gate 0
   needs only the automatic runtime, and TS/babel/swc/esbuild all support
   `jsxImportSource`. The classic pragma adds a second calling convention
   (children-variadic, key-in-props differences) for no current consumer. The `host()`
   table can grow a `createElement` slot later without breaking anything.
3. **`render` proxy out of scope.** Issue #106's open question on host-capability
   negotiation (coarse vs fine-grained vs retained) is real and unresolved; nothing in
   Gate 0 needs it (router renders *through* `Component`, whose render path the adapter
   already owns per #100). Bundling it here would stall the router on the hardest open
   design in the issue.
4. **JSX namespace lives on the runtime entry, not on `Component`.** TS resolves the
   namespace from the `jsxImportSource` module - it *must* exist there. Re-merging it
   onto `Component` (issue's open question) adds an alias surface with no resolver
   benefit; skip it. `Component.Node`/`Component.FC`/`Component.Props` remain the
   author-facing types; `JSX.*` is transpiler plumbing plus the `IntrinsicElements`
   lookup hook.
5. **Introspection as functions over a normalized element shape.** Considered having
   `jsx` wrap host elements in an mvc envelope (`{ type, props, host }`) so introspection
   needs no host registration. Rejected: the envelope would have to be unwrapped before
   the host reconciler sees it - meaning mvc intercepts every element render-side, which
   *is* the render proxy problem (deferred), and breaks interop where react elements and
   mvc elements mix in one tree.
6. **Solid caveat (recorded, not solved).** Solid normally compiles JSX away; a runtime
   `jsx()` delegation forces its hyperscript path (`solid-js/h`), losing fine-grained
   compilation for agnostic-library subtrees. Acceptable for router-scale UI; a real
   Solid story likely needs the compile-time alias route (alternative 1) per-app, or the
   eventual first-party host. This is a known host-assumption of the seam, same family as
   the subcomponent-walk assumption #100 moved into the react adapter.

## Risks

- **Import-order footgun**: agnostic module evaluating JSX at module scope before adapter
  import. Mitigated by the explicit error message; rare in practice (JSX at module scope
  is unusual).
- **`jsxDEV` divergence**: dev transpile + prod-only host registration. Mitigated by
  the documented fallback in `jsx-dev-runtime.ts`.
- **Type-level `JSX.Element = unknown` pre-adapter** is permissive, not strict - a
  program with no adapter types won't catch "returned a non-element". Accepted; mirrors
  `Component.Node`'s existing degenerate behavior.
- **React 19 ref-as-prop / key semantics** are the host's business - mvc forwards `key`
  positionally and never inspects props, so it inherits whatever the host does.
- **Coverage**: mvc requires 100% - the new `src/jsx*.ts` need tests covering delegation,
  double-registration conflict, unregistered-error, dev fallback, and introspection
  pass-through (mock host, no react import in mvc tests).

## Sequencing

1. This PLAN (this commit).
2. `feat(mvc)`: `src/jsx.ts` + runtime entries + exports map + tests.
3. `feat(react)`: `host({...})` registration + `JSX.IntrinsicElements` augmentation +
   tests rendering mvc-runtime-compiled JSX under React.
4. `refactor(router)`: migration per sketch (on the router branch line).

## Open questions for review

- `host()` vs `Component.host()` vs growing the existing adapter-facing surface - is a
  new root export the right shelf, or should registration ride `Component.on`-style?
- Should `Fragment` also accept *unregistered* identity use (sentinel + host map) so
  router-style walks can run hostless (e.g. SSG analysis)? Current answer: no, wait for a
  use case.
- Phase-2 `@expressive/mvc/dom` host-neutral intrinsics: worth an issue now, or wait
  until an adapter-less consumer exists?
- `Component.FC` naming (`FC` carries react connotation; `Component.Render`?
  `Component.Type`?).
