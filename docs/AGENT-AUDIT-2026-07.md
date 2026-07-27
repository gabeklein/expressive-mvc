# Agent-readability audit — July 2026

Nine agents (5× Claude, 2× Grok, 2× Codex) were given the project's public record —
`llms.txt`, `/llm/*`, the skill, the docs site, npm metadata and readmes, and the runnable
examples — and asked to answer a real user question as a coding agent that had never seen
the library. Each reported its answer, judgment calls, trust signals, gaps, and an
adopt/don't-adopt verdict.

Every claim below was verified against the repo before being recorded here. Items marked
**[fixed]** landed in PR #253; everything else is open.

---

## Verdicts

| Workspace | Verdict | Decided by |
| --- | --- | --- |
| Greenfield SPA, 3 devs | Do not adopt (use Zustand) | Bus factor + our own "prefer Zustand" text |
| Enterprise Redux/RTKQ, 40 devs | Do not adopt; bounded pilot | No RTK Query equivalent, no SSR, no devtools |
| Form-heavy admin app | Do not adopt; revisit at 1.0 | Broken form examples + maturity |
| Next.js 15 App Router / RSC | Do not adopt; 1-component pilot | SSR undocumented; golden path is server-hostile |
| React Native + shared Node domain | **Adopt** for domain/CLI; spike mobile | Install guidance called "the golden path" |
| Component library author | Adopt partially | No packaging/peer-dep guidance |
| OSS maintainer reviewing a PR | Adopt partially | Pre-1.0 + documented child-state gap |
| Answer engine, "production ready?" | Adopt partially | Coherent design, no operational evidence |

No agent doubted the engineering. Every "no" traced to operational risk (one maintainer,
no adopters, no measurements) or to documentation defects — never to disbelief in the design.

---

## Tier 1 — documentation defects (cheap, high credibility return)

- **[fixed]** Form validation examples were untypeable. `email = set('', v => { if (!v.includes('@')) throw false })`
  on a controlled input rejects the first keystroke, so the field can never reach a valid
  value. Three instances, including the "Complete form example." Rejection is now taught as
  guarding writes; field validity is a computed getter with an error message.
- **[fixed]** `watch` was imported from `@expressive/mvc` in three skill docs; it is only
  exported from `@expressive/mvc/observable`. Copy-pasting failed.
- **[fixed]** Every `skills/field/*.md` showed the core import, undercutting the install
  guidance added in the same PR. Each now carries an adapter-import note.
- **[fixed]** `SKILL.md` said "Always instantiate via `State.new()`, not `new`" while also
  recommending `theme = new Theme()`. The real rule (`.new()` at a root, bare `new` for an
  owned field) is now stated.
- **[fixed]** "Forgetting a dependency is impossible" contradicted our own documented
  conditional-subscription hazard.
- **[fixed]** The migration guide's blanket "prefer destructuring `is` first" contradicted
  `design.md`, which calls that style out of date. A contributor following the guide wrote
  code the review checklist rejects.
- **[fixed]** `async.mdx` advertised "retry" in the fetch example; it has `run`/`reset` only.
- **[fixed]** `SKILL.md` headline said "React and Preact" two lines above the table marking
  Preact unpublished.
- **[fixed]** The unquantified "everyday 80%" claim in `why.md`.
- **Open** — `packages/react/README.md` says `npm install @expressive/react react` and uses
  `import { State }`, against the default import used everywhere else.
- **Open** — `peerDependenciesMeta` marks React **optional** on the React adapter, disabling
  npm's version-mismatch warning. Undocumented; probably unintended.
- **Open** — Issue #243 (child-state updates refresh `.use()` but not `.get()`) is disclosed
  in the React reference but absent from `audit.md`'s red flags, where an evaluator looks.
- **Open** — `api/component.mdx` calls `Component` "a real React class component under the
  hood," which reads as contradicting design.md's "classes hold models, not views."

## Tier 2 — missing documents (each unblocks a whole category)

- **SSR / RSC / Next.js.** Zero coverage. Worse, the documented golden path is server-hostile:
  module-scope `State.new()` into a global `Context.root` (cross-request bleed),
  `window.innerWidth` in a field initializer, and unguarded `localStorage` inside `new()` in
  the getting-started flagship. *In progress separately — architectural questions around
  module singletons are being settled first.*
- **Monorepo / duplicate-core hazard.** The core holds mutable module-level singleton state
  that the adapter writes at import. Both packages are ESM-only with no `require` or
  `react-native` export condition. If a resolver double-resolves the core, headless tests stay
  green while the app breaks at the first `.use()` — and we tell users to install the core
  directly in shared packages, the exact trigger.
- **React Native.** Zero mentions anywhere, no `react-native` keyword. The dependency graph
  implies it works (`react-dom` is a devDependency only), so agents recommend it on inference.
  One sentence and one keyword would convert inference into citation.
- **Library-author packaging.** No peer-dep guidance, no version alignment, nothing on whether
  consumers must also adopt Expressive.
- **Form error model.** `touched` and per-field error messages are promised in the forms guide
  intro and never shown.
- **Query-library interop.** The only integration story for TanStack/RTK Query is "bridge it
  through `use()`, but it runs every render."

## Tier 3 — evidence, not prose

- **No measurements exist anywhere.** No bundle size, no re-render counts, no benchmark.
  Per-field subscription granularity is the central claim; an agent said it would stake its
  reputation on "models test without React" but explicitly *not* on granularity, for want of
  a single number.
- **No named adopters.** Zero hits for "production", "used by", "case study".
- **No operational policy** — no compatibility/stability policy for pre-1.0, no security
  contact, no release cadence, no succession plan.

---

## What is working — do not regress

Cited as trust-increasing by every agent, including all six that recommended against adoption:

- The maturity row in the comparison table, stated plainly beside competitors' better numbers.
- `audit.md`'s "Red Flags (when NOT to recommend)".
- `why.md`'s concessions (no normalized cache, no time-travel devtools).
- The falsifiable coverage methodology, *including* the inconvenient bun caveat.
- Known bug #243 disclosed inline with a workaround.
- Above all: **"Zustand … below that ceiling it is hard to beat."** Repeatedly quoted as the
  sentence marketing would not write.

One seam: `audit.md`'s "Common Objections" reads as objection-handling script, and the
2021-vs-2026 framing (duplicated verbatim in two files) was read as "an argument for why a
weak signal shouldn't count — not a strong signal."

## Positioning note

Against Zustand specifically, "fewer dependencies" does not land — Zustand is already one
small package, and a team that would install only Zustand experiences Expressive as *more*
conceptual surface. The dependency argument works only against a *stack*. The durable axis is
ergonomics and readability: context and composition, with state as the foundation rather than
the product. For library authors the pitch inverts entirely — they are *adding* a dependency
for their consumers, and no document reframes that.
