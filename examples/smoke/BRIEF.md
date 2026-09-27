# Agent brief - dom smoke scenarios

Goal: prove `@expressive/dom` does not regress the runtime interaction behavior the example pages demonstrate. The React pages are the spec. Worktree: `/Users/gabeklein/Projects/expressive-mvc/.agents/worktrees/dom-smoke`; run commands from `examples/`. Read `smoke/README.md`, `smoke/harness.ts`, `smoke/essentials.test.ts` (reference scenario), and `skills/dom/dom.md` (documented intentional differences from React) first.

## Per page in your group

1. Read `pages/<group>/<page>/` (all files) - the frame copy (`<h1>`, `<p>`, `<small>`) states the user story. Write a scenario in `smoke/<group>.test.ts` (one `describe('<group>/<page>')` per page) that drives every interactive control through the story and asserts visible results after each step. Assert on text/structure/attributes a user or a CSS rule would depend on (classes, `disabled`, `aria-*`, input values, focus where the page relies on it).
2. Make it pass on the `react` project first. A scenario that fails on React is a wrong scenario - fix the scenario, never `pages/`.
3. Run it on `dom`. On failure, diagnose to a root cause - read `packages/dom/src` - and classify:
   - **port** - codemod gap in `pages-dom` (a leftover React idiom). Fix it in `pages-dom` minimally.
   - **semantic** - intended, documented difference (cite the line in `skills/dom/dom.md`). Fix `pages-dom` idiomatically for dom, note the fix.
   - **undocumented** - differs from React, plausibly intended, but `skills/dom/dom.md` does not say so. Fix `pages-dom` so the rest of the scenario can proceed, and record it.
   - **bug** - renderer misbehaves. Do NOT work around it in `pages-dom`; leave the scenario failing on `dom` and write a minimal repro (a few lines of JSX + expected vs actual) with the suspect source location.
   - **harness** - happy-dom or harness limitation (e.g. no layout, pointer capture). Say so; do not count as a regression. Shape assertions around it if possible.
   Never change a scenario's expectations to accommodate dom.
4. `smoke/diff.sh <group>` compares the React and dom DOM trails. Classify every diff hunk the same way (attribute order is already normalized away only if identical - treat pure attribute-order or whitespace noise as noise and say so).
5. Make `../node_modules/.bin/tsc -p tsconfig.dom.json` clean for your group's files (type errors are findings too - classify them: a React-typed idiom is **port**, a dom type that rejects something its runtime supports is **type gap**).

## Rules

- Only edit: `smoke/<group>.test.ts`, `smoke/findings/<group>.md`, and `pages-dom/<group>/**`. Do not edit `pages/`, `packages/`, or shared harness files - other agents run concurrently. Put extra helpers (drag, fake timers, pointer sequences) at the top of your own test file.
- Run only your file: `../node_modules/.bin/vitest run -c smoke/vitest.config.ts smoke/<group>`.
- Timers: prefer real short waits via `settle(ms)`; if a page uses long intervals, `vi.useFakeTimers({ toFake: ['setTimeout','setInterval','Date'] })` is fine if it works on both projects.
- Do not commit.
- Known already (do not re-investigate beyond confirming impact on your pages): dom's `Node` type (`packages/dom/src/vnode.ts`) rejects `has`/`map` collections as children though runtime renders them; `onDoubleClick` / `autoFocus` / `defaultValue` rejected by dom's types; dom inserts comment anchors per component.

## Findings file (`smoke/findings/<group>.md`)

Terse. Per page: status on react / dom, then each finding as `- [class] summary - file:line - repro/evidence`. End with a section "Beyond unit tests": any scenario that caught a renderer behavior `packages/dom/src/*.test.*` does not cover (grep them to check) - these are candidates for permanent validation. Your final message: the findings file content verbatim.
