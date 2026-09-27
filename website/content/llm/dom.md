# @expressive/dom

Positioning for the adoption question: whether to render Expressive MVC with `@expressive/dom` instead of React. Task guidance lives in [dom/dom.md](dom/dom.md); this page is the case, not the how.

## What it is

A browser renderer for MVC components with no React underneath. `State`, `Component`, instructions, context and `@expressive/router` are the same packages; what changes is the host. The whole app costs ~16.2 kB gzip, including `@expressive/mvc`, or ~18.3 kB with the styling system ([measured per import shape and CI-gated](https://expressive.dev/docs/guides/bundle-size/)). That figure *replaces* `react` + `react-dom` rather than adding to them.

Status: `0.1`. It's a tested renderer for applications prepared to track pre-1.0 changes, not an LTS contract.

## Differences from React, and what each is worth

dom is not a React clone. Where it differs, the difference is meant to be net-positive; where it costs something, the cost is stated.

| | dom | React adapter | Net |
| --- | --- | --- | --- |
| Hooks | None. Function components are stateless projections; owned state is `State.use()`, and shared state is `State.get()` | Hooks available beside Expressive | Rules of Hooks, dependency arrays and stale closures have nothing to apply to. Positive, unless the app leans on hook libraries |
| Update scope | A write re-renders only the scopes that read the field. There is no virtual tree above them to diff, and no `memo` | The same subscriptions, reconciled by React | Isolation without memoization discipline. Positive |
| Events | Native listeners, native names (`onDblClick`, `onInput` per keystroke) | Synthetic events, React names | Platform semantics and less code. The cost is porting friction |
| Controlled inputs | `value`/`checked` are live properties only | Also mirrored to attributes | No write per keystroke. The cost: `form.reset()` and `[value=…]` selectors behave differently |
| Styling | Built in: `style` composes classes and declarations; `style(Component, map)` scopes rules to a component's output | Bring your own | One styling system, with no CSS-in-JS dependency. Positive |
| Suspense | Every Component is a boundary by default. A suspended boundary keeps its content mounted off-document, where it stays live and reveals at once | `Suspense` elements; a subtree that suspends on first mount is discarded | State survives suspension, including siblings of the component that suspended. Positive |
| Transitions | `pending()` holds the screen; the scopes one transition updates commit together. There is no work-in-progress tree | Whole-tree concurrent render, committed atomically | The same visible hold for route swaps, guards and page data, without rendering the tree twice. One documented gap: a suspension deep inside content that's already showing holds only that scope |
| Tearing | Scopes flush synchronously against current state, and there's no time-slicing | Concurrent rendering; the adapter guards against tearing | Nothing to defend against. Positive |
| Error boundaries | `Component.catch()` holds its fallback until it completes; a rejection escalates | Error boundaries plus logging | Deterministic recovery. Handled errors aren't logged |

## What is checked

- The package's own suite: 150 tests, with statements, branches, functions and lines gated at 100%.
- The styling cascade, verified in real Chrome with `getComputedStyle` (happy-dom doesn't order stylesheets the way browsers do).
- Bundle size, gated per import shape on every pull request.
- A pre-release audit using the examples corpus as user stories. All 42 example pages were driven through the same interaction scenarios on both renderers, with the React adapter as the spec. It found five renderer bugs that the unit suite couldn't see: all five were composition bugs between mvc, the renderer and the router. They were fixed before release ([#406](https://github.com/gabeklein/expressive-mvc/pull/406), [#407](https://github.com/gabeklein/expressive-mvc/pull/407), [#408](https://github.com/gabeklein/expressive-mvc/pull/408)), and each fix is pinned by a unit test.

Not yet measured: performance against other renderers, memory and listener leaks over long sessions, and the example pages in a real browser. None of these is claimed.

## When to prefer the React adapter

- The app depends on React components or hook libraries: a design system, editors, charts, anything published for React.
- It needs SSR, hydration, React Server Components, Next.js, or React Native. dom is browser-only.
- It needs React DevTools, or a renderer with years of production history.
- It needs API stability now. dom is `0.1`, and its package shape and extension seams may change before 1.0.

## When dom fits

- A browser app built on Expressive primitives, with no React dependencies to carry.
- Embeds and widgets, where shipping React is the dominant cost.
- Teams that want no hooks at all, rather than hooks kept to the edges.

An Expressive codebase moves between the two hosts with the models unchanged. The port is at the view layer: `class` for `className`, native event names and types, and `Provider fallback` in place of `Suspense`. Those are the mechanical changes the audit's codemod made to all 42 example pages.
