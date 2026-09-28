# @expressive/dom

Positioning for the adoption question: whether to render Expressive MVC with `@expressive/dom` instead of React. Task guidance lives in [dom/dom.md](dom/dom.md); this page is the case, not the how.

## What it is

A browser renderer for MVC components with no React underneath. `State`, `Component`, instructions, context and `@expressive/router` are the same packages; what changes is the host. [Measured per import shape](https://expressive.dev/docs/guides/bundle-size/), gzip, including `@expressive/mvc`:

- `Component` + `render` alone: ~15.5 kB
- the renderer and all of mvc: ~16.8 kB
- the same with the styling system: ~19.0 kB
- the same with `@expressive/router`: ~20.4 kB

These replace `react` + `react-dom`; they don't add to them. Budgets are checked on every pull request, and an over-budget shape fails the site build.

Status: `0.1`, the first release. It's a tested renderer for applications prepared to track pre-1.0 changes, not an LTS contract.

## Differences from React, and what each is worth

dom is not a React clone. Where it differs, the difference is meant to be net-positive; where it costs something, the cost is stated.

| | dom | React adapter | Net |
| --- | --- | --- | --- |
| Hooks | None, beyond `State.use()` for owned state. It keeps one rule: top-level calls in stable order, enforced at runtime. Shared state is `State.get()` | Hooks available beside Expressive | Dependency arrays and stale closures have nothing to apply to. Positive, unless the app leans on hook libraries |
| Update scope | A write re-renders only the scopes that read the field. A re-rendering scope re-renders its child components; there is no `memo` | Same subscription granularity, and `memo` is available | Same isolation without memoization discipline. The cost: no bailout, so an expensive subtree should read its own state rather than take it as props |
| Props and events | Native listeners and event objects. React's `className`, `autoFocus` and `onDoubleClick` are accepted. `onChange` on a text field keeps its native commit timing; `onInput` fires per keystroke, on React too | Synthetic events | Platform semantics with no event layer, and React spellings still work. The cost: `onChange` on text fields |
| Controlled inputs | `value`/`checked` are live properties only | Also mirrored to attributes | No attribute write per keystroke. The cost: `form.reset()` and `[value=…]` selectors behave differently |
| Styling | Built in: `style` composes classes and declarations; `style(Component, map)` scopes rules to a component's output. Rules are injected at runtime; there is no build-time extraction | Bring your own | One styling system, with no third-party dependency, for ~2.1 kB |
| Suspense | Every Component is a boundary unless `fallback = false`. A suspended boundary keeps its content mounted off-document, where it stays live, and reveals it at once | Also a boundary per Component; a subtree that suspends on first mount is discarded and rebuilt | State survives suspension, including siblings of the component that suspended. Positive. The cost: hidden content is detached, so it can't be measured while its fallback shows (React keeps it in the page with `display: none`). Note for both: the default fallback is `null`, so a suspending Component with no `fallback` renders blank rather than letting an outer fallback show |
| Nested boundaries | A boundary hidden inside another keeps its own state through the outer reveal | Rebuilt | State survives. An inner fallback still showing stays showing |
| Transitions | `pending()` holds the screen; the scopes one transition updates commit together, and a newer transition supersedes a held one. There is no work-in-progress copy, and probed output is reused, so nothing renders twice | Renders the transition off-screen and commits it atomically | The same visible hold for route swaps, guards and page data. One documented gap: when a suspension surfaces deep inside content already on screen, other scopes of the transition can show the new state meanwhile |
| Tearing | Writes batch to a microtask, and each flush runs to completion without yielding | Concurrent rendering; the adapter guards against tearing | Urgent updates can't tear. Within a transition, the gap above can briefly show mixed versions |
| Errors | `Component.catch()` holds its fallback until it completes; a rejection escalates to the next boundary. Handled errors aren't logged. An update error with no boundary is logged, and the last good DOM stays mounted | `Component.catch()` through a host error boundary; React logs each caught error, and an unhandled one unmounts the root | Deterministic recovery ([#408](https://github.com/gabeklein/expressive-mvc/pull/408) removed a timing race). Log inside `catch()` if you need a trail |

## What is checked

- The package's own suite, with statements, branches, functions and lines gated at 100%. Components test in happy-dom with vitest, as this suite does.
- The styling cascade, verified in real Chrome with `getComputedStyle` by `cascade-probe.ts`. This is run manually, not in CI.
- Every publish type-checks, bundles and drives a small consumer app built from the packed tarballs.
- A pre-release audit using the examples corpus as user stories ([record](https://github.com/gabeklein/expressive-mvc/blob/111785fc0/examples/smoke/AUDIT.md)): 53 interaction scenarios over all 42 example pages, run on both renderers in happy-dom, with the React adapter as the spec. It found five renderer bugs the unit suite couldn't see (three of them in how dom composes with mvc's tracking and `pending()`, surfacing on router pages), plus several React-parity differences. All were fixed before release in [#406](https://github.com/gabeklein/expressive-mvc/pull/406)–[#408](https://github.com/gabeklein/expressive-mvc/pull/408), each pinned by a unit test or a type check. On the fixed renderer, dom passes every scenario except the nested-boundary difference above, which is intended. Independent adversarial reviews of each fix then found and fixed further regressions before release, each also pinned by a test.
- The fixed renderer, driven in real Chrome: all 42 ported example pages loading and surviving interaction, and a consumer app from the packed tarballs.

Not yet measured: performance against other renderers, memory and listener leaks over long sessions, and interop with libraries that mutate the DOM themselves. The dom-only features (`style`, `macro`, `createPortal`, `lazy`) have their own suite but were exercised by the audit only incidentally. None of these is claimed.

## When to prefer the React adapter

- The app depends on React components or hook libraries: a design system, editors, charts, anything published for React.
- It needs SSR, hydration, React Server Components, Next.js, or React Native. dom is browser-only.
- It needs React DevTools, or a renderer with years of production history.
- It needs API stability now. dom is `0.1`, and its package shape and extension seams may change before 1.0.

## When dom fits

- A browser app built on Expressive primitives, with no React dependencies to carry.
- Embeds and widgets, where a React runtime would otherwise be the largest dependency.
- Teams that want no hooks beyond `State.use()`.

An Expressive codebase moves between the two hosts with its models unchanged. With imports from `@expressive/mvc`, the recommended path, only `Provider` and `Consumer` come from the host package, and both hosts export them with the same props. The remaining port is small: `onChange` → `onInput` on text fields (equivalent on React), React event-type annotations dropped or inferred, and `Suspense` → a Component `fallback`.
