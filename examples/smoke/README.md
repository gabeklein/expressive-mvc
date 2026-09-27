# dom smoke - examples as user stories

Archive branch. `pages/` (React) is the spec; `pages-dom/` is the same pages ported to `@expressive/dom`.

- Port: `bun smoke/port.ts` (already applied) - imports, `className`→`class`, text `onChange`→`onInput`, jsx pragma.
- Types: `../node_modules/.bin/tsc -p tsconfig.dom.json`
- Run: `../node_modules/.bin/vitest run -c smoke/vitest.config.ts [smoke/<group>]` - projects `react` and `dom` run the same scenario.
- Diff DOM trails (every interaction snapshots innerHTML, comment anchors stripped): `smoke/diff.sh [pattern]`
- Findings: `smoke/findings/<group>.md`
