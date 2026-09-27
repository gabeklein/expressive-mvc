# @expressive/dom - examples smoke audit (2026-09-27)

A pre-release check that `@expressive/dom` does not regress the interaction behavior the example pages demonstrate. The examples are the library's user stories, and the React adapter's behavior on them is the spec.

- **Audited:** `origin/main` @ `522606a7c` (`@expressive/dom` 0.0.0, unreleased).
- **Evidence branch:** `chore/dom-smoke`, archived and not for merge. It contains the harness, the ported pages, the scenarios and the per-group findings.
- **Result:** React passes 53/53 scenarios; dom passes 46/53. The 7 dom failures trace to 5 renderer bugs, plus one intended difference. The fix list is in [PRERELEASE-FIXES.md](PRERELEASE-FIXES.md).

## Method

1. **Port.** `examples/pages` was copied to `examples/pages-dom` and run through a codemod (`smoke/port.ts`). The codemod switches adapter imports to `@expressive/mvc` / `@expressive/dom`, changes `className` to `class`, changes the text-field `onChange` to `onInput`, and adds a dom JSX pragma. Remaining port errors were fixed by hand, and each fix was classified (see Classes).
2. **Scenarios.** Each of the 42 pages got a scenario that drives every interactive control through the story stated in the page's own copy, asserting visible text, structure, attributes, input values and focus after each step. A render-only check was never counted as a pass.
3. **Dual run.** The same scenario runs as two vitest projects: `react` mounts `pages/` via `react-dom/client`, and `dom` mounts `pages-dom/` via `@expressive/dom`'s `render`. Both run in happy-dom. Any unexpected `console.error`, uncaught error or unhandled rejection fails the test.
4. **Spec first.** A scenario had to pass on React before it counted. Expectations were never loosened to suit dom. Renderer bugs were left failing, not worked around in `pages-dom`.
5. **DOM trails.** Every interaction snapshots `innerHTML`. `smoke/diff.sh` diffs the React and dom trails with dom's comment anchors stripped, so drift that no assertion covers still surfaces. Every hunk was classified.
6. **Independent repro.** Every renderer bug was re-reproduced by a minimal throwaway test in `packages/dom`, separate from the pages.

Seven agents split the work by page group, under one brief (`smoke/BRIEF.md`). Their raw findings are in `smoke/findings/*.md`.

### Classes

| Class | Meaning | Handling |
|---|---|---|
| bug | renderer misbehaves | scenario left failing, minimal repro |
| semantic | intended difference documented in `skills/dom/dom.md` | page adapted idiomatically |
| undocumented | differs from React, plausibly intended, not documented | page adapted, listed for docs |
| type gap | dom types reject something its runtime supports | listed |
| port | leftover React idiom in `pages-dom` | fixed |
| harness | happy-dom limitation (layout, pointer capture, label activation) | stubbed identically on both projects |
| page | the React baseline page itself is wrong | scenario asserts actual React behavior |

## Results

| Page | react | dom | Notes |
|---|---|---|---|
| essentials/counter | pass | pass | |
| essentials/async | pass | pass | |
| essentials/computed | pass | pass | `value` attribute not reflected (fix #8) |
| essentials/fetch | pass | pass | |
| featured/forms | pass | pass | |
| featured/spreadsheet | pass | pass* | `autoFocus` replaced by ref focus (fix #6) |
| featured/tictactoe | pass | pass | |
| featured/stopwatch | pass | pass | |
| featured/kanban | pass | **fail** | bugs #1, #2; `onDblClick`, `autoFocus` adapted |
| component/props | pass | pass | |
| component/subcomponents | pass | pass | |
| component/injection | pass | pass | page bug #17 on both |
| component/headless | pass | pass | |
| component/lifecycle | pass | pass | mount/unmount order identical |
| component/suspense | pass | pass | |
| component/boundary | pass | **fail** (2/3) | intended nested-boundary difference (fix #10); escalation race adapted (fix #7) |
| component/custom | pass | **fail** (2/3) | bug #5 |
| composition/nested | pass | pass | |
| composition/context | pass | pass | render isolation verified by count |
| composition/concerns | pass | pass | |
| composition/extension | pass | pass | |
| composition/globals | pass | pass | render isolation verified by count |
| instructions/def | pass | pass | |
| instructions/get | pass | pass | |
| instructions/get-downstream | pass | pass | |
| instructions/has | pass | **fail** | bug #1 |
| instructions/has-list | pass | pass | spreads the list, so bug #1 is not reached |
| instructions/map | pass | **fail** | bug #1 |
| instructions/map-insert | pass | pass | |
| instructions/ref | pass | pass | ref attach/detach identical |
| instructions/ref-multiple | pass | pass | |
| instructions/set | pass | pass* | rejected write reverted manually (semantic) |
| instructions/set-computed | pass | pass | |
| instructions/set-factory | pass | pass* | `Suspense` → `Provider fallback`; page bug #16 on both |
| router/overview | pass | pass | |
| router/browser | pass | pass | history back/forward via popstate |
| router/params | pass | pass | |
| router/query | pass | pass | |
| router/nav | pass | pass | |
| router/wizard | pass | pass | |
| router/guards | pass | **fail** | bugs #3, #4 |
| router/transitions | pass | **fail** | bug #3; urgent mode identical |

\* passes after an idiomatic adaptation of `pages-dom` for a documented or undocumented difference, not a workaround for a bug.

Totals: 42 pages, 53 scenarios, 106 runs. React: 53 pass. dom: 46 pass, 7 fail.

`tsc -p examples/tsconfig.dom.json`: clean apart from 3 errors, all type gap #13 (`has`/`map` as JSX children).

## Rerun

```bash
git checkout chore/dom-smoke && bun install
cd examples
../node_modules/.bin/vitest run -c smoke/vitest.config.ts   # both projects
smoke/diff.sh [pattern]                                      # React vs dom DOM trails
../node_modules/.bin/tsc -p tsconfig.dom.json
```

## Limits

- happy-dom only: no layout, cascade or real focus heuristics. Layout-dependent pages (ref drag, custom arc) stub `getBoundingClientRect`. `.github/scripts/cascade-probe.ts` covers the cascade separately; no real-Chrome pass of the examples was run.
- Not covered: performance, memory or listener leaks over repeated mount/unmount, large lists, and third-party DOM mutation.
- Scenarios assert what each page demonstrates. The examples were written for the React adapter, so dom-only features (`style()`/`macro`, `createPortal`, `lazy`) are exercised only incidentally.

## Resolution

Addressed by three stacked PRs: #406 (tracked views: fixes #1, #2, #13, #17), #407 (transition batches: #3, #4), and #408 (parity sweep: #5–#12, #14–#16; this record is linked from its description). The rationale and revisit conditions for each call are in those PR descriptions.

Rerun against #408's stack: dom passes every scenario except `component/boundary > will rebuild an inner fallback under an outer one`, the intended difference documented in #408. On React, `component/injection` and `instructions/set-factory` now fail, because their scenarios pinned the buggy baseline pages that #406 and #408 fix.
