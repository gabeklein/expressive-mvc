# examples/AGENTS.md

Guide for the examples playground - a Vite app whose pages ship as crawlable, prerendered example pages on the website.

## Pages are code-first

Each crawlable page exists to serve the source being demonstrated: prerendered output lists every file as copy-pasteable code, which hydration swaps for the live editor. Agents crawling these pages are looking for "how to do a thing" - the source is the content. Never add marketing or pitch prose to these pages.

## Page conventions (`pages/**/App.tsx`)

Declaration order:

1. Imports, then module sentinels (constants).
2. `export default` - a *frame* component: `<div className="container">` holding the `<h1>`, the descriptive `<p>`, the demo as an element (`<Dashboard />`), and any trailing `<small>` note. The export comes first because it is what the reader looks for; the only forced exception is a module sentinel calling `.new()` at eval time, whose class must sit above it.
3. Supporting components and classes.
4. Helper functions last.

Style:

- All descriptive copy lives in the frame. Demo components hold only live content: readouts, `fallback`s, error messages, control labels. A trailing note belongs below the demo element in the export, not inside the demo.
- Copy over comments: anything a comment would explain to the reader belongs in the page's visible copy instead. This is stricter than the repo-wide no-comments rule - an example has a place to put the explanation, so it must use it. Keep a comment only when copy genuinely cannot carry it (cryptic math, why a line is shaped a certain way).
- Arrow functions for function components, consistently. Plain helpers may stay declarations when their position requires hoisting.
- `new Child()` for nested state, never `Child.new()` - bare construction makes the instance state the parent owns (built there, activated into that context, destroyed with it); `.new()` creates a private context-less instance.
- Owned collections use `has()`, never a plain array reassigned by spread - `push` to append, `clear` to reset, `.map((v, i) => ...)` directly in render (it tracks). Spread-and-replace is the React reflex, and an example is where reflexes get copied.
- Keep each example focused. Prefer a render prop over a subclass or subcomponent seam; declare extra render props as `render(props = {} as { ... })`.
- Name demo components for their role, never `Demo`. A `fallback` belongs in a `Fallback()` subcomponent, not JSX built inline inside `catch()`. Render-less components are fine when tree placement is the point.
- Instance-rendering demos use a swappable class member (`active` holding an instance that gets reassigned), not a module-scope singleton placed twice - the lesson is that the field decides what renders, never what exists.
- Reuse the theme tokens from `global.css` (`--s1..6`, `--accent`, `--surface`, ...); register each page in its group's `index.ts` manifest.

## Host-agnostic source

Every page runs on `@expressive/react` and `@expressive/dom` unchanged. Keep it that way:

- Import `State`, `Component` and instructions from `@expressive/mvc`. Only `Provider` / `Consumer` come from `@expressive/react`, which dom mode aliases.
- No `react` imports in pages. Use `Component.Node` for children, and structural types for handler parameters that need annotating.
- Text fields use `onInput` (identical on React). Checkboxes and selects keep `onChange`.
- No `Suspense`: give the component that owns the pending value a `fallback`.
- SVG presentation values that differ in attribute casing between hosts (`strokeDasharray`) go in `style`.

## Specs

Each page has a Playwright spec beside it: `pages/<group>/<page>/App.spec.ts`. `coverage.spec.ts` fails when a page lacks one. Specs are excluded from the published source.

```bash
cd examples && bun run e2e                           # both hosts
bunx playwright test pages/router/            # one group (trailing slash: exact folder)
bun run dev:dom                                      # dom frames: /dom.html?page=<group>/<page>
```

- Import `{ expect, test }` from `e2e.ts`. `open('<group>/<page>')` loads the page standalone on the project's host (React at `/?page=`, dom at `/dom.html?page=`). Any `pageerror` or `console.error` fails the test.
- Drive the page's own story, the one its copy states, with role and text locators and web-first assertions. Stub network with `page.route`. For time, install the clock before `open()`. Pause it (`install({ time: 0 })` then `pauseAt(1000)`) when the spec asserts exact readouts: an unpaused clock still follows real time, which flakes on slow runners. Router navigation flushes run on timers, so router specs keep the clock running and sample while holding.
- A spec must pass on both projects without branching on `host`. The one intended exception is `component/boundary`'s nested-boundary rebuild.
