# RESUME - router matching model spike

> **Ephemeral - delete on adoption.** This file lives in its own commit at the tip of
> `feature/router`. When the spike work is picked up, drop this commit (`git rebase`/`reset`
> to remove it, or `git rm RESUME.md`) so it never lands in the PR. It is handoff scaffolding,
> not project documentation - the durable record is in [packages/router/PLAN.md](packages/router/PLAN.md).

Handoff for continuing in a fresh (cloud) session. Branch: `feature/router`.

## What to build

Implement the **prefix-default + remainder-poison** matching model for `@expressive/router`.
Full rationale and spec: [packages/router/PLAN.md](packages/router/PLAN.md), section
**"Matching model: prefix-default + remainder poison (next)"**. Read that first - it carries
the reasoning chain (lexical inference is unsound -> prefix must be default -> poison closes the
leak -> `exact`/`index`/`catchAll` all retired, `*` reborn as "claim remainder, suppress poison").

### The model in one paragraph

A pattern match is now **prefix by default** (path need only *start with* the pattern), making
matching children-independent. A prefix match is **provisional**; it is **confirmed** only if the
full remainder is consumed below (a descendant exact-matches the tail, or a `*` Route claims the
rest). A provisional match whose remainder **dangles** **rejects**, cascading to the next ancestor
with an alternative (sibling / fallback), else 404.

### Concrete next step (spike, behind green tests)

1. **`url.ts`**: make `matchPattern` prefix-match by default (drop the `length === fixed` equality
   requirement for non-catch-all; allow `pathParts.length >= patternParts.length`). Keep returning
   the remainder so a Route can tell whether its tail is empty. `*` keeps claiming the rest.
2. **`route.ts`**: add a `consumed` getter -
   `leaf-with-empty-remainder OR is-a-`*`-route OR (some registered `inner` child is `consumed`
   and accounts for the tail)`. Gate render/`matched` confirmation on it so a rejected match
   renders `null` and cascades. `as`-internal Routes are visible in `inner` (their
   `parent = get(Route)` resolves to the nearest Route context).
3. **Acceptance tests** (must fail before the change, per AGENTS.md): in
   `packages/router/src/acceptance.test.tsx` (or `route.test.tsx`):
   - `/about/garbage` against a true leaf `<Route to="about" as={About}/>` -> 404 (About does NOT render).
   - `as`-internal routing: a page component that renders `<Route to="edit"/>` -> `/x/edit` matches.
   - cascade: layout whose only matching child rejects -> layout rejects too -> 404.

### The risk to validate

Matching now depends on what a component routes to *internally*, knowable only after it renders.
So a would-be-404 path renders its candidate subtree once, then unwinds - a **double render** - and
the reject must be a **stable fixed point** (flip to rejected, children deregister, stays rejected;
must NOT oscillate). If it oscillates or the double-render is unacceptable, fall back to explicit
`exact` with accepted leaks and report back.

## Constraints (from CLAUDE.md / AGENTS.md)

- `bun test` is the runner (NOT vitest/jest). Per package: `tsc --noEmit && bun test --coverage`.
  Coverage target 100% lines/functions/statements.
- Tests must fail without the change. Update tests alongside behavioral changes.
- **Merged code carries essentially no comments** - strip build-time narration before committing.
- Conventional commits, **no `Co-Authored-By`**, no em dashes. Don't commit without confirmation
  (in a cloud/autonomous run, commit logically-grouped work but keep messages conventional).
- Stop and surface regressions rather than brute-forcing a fix.

## State at handoff

- All clear on the existing suite (128 pass / 1 skip at last run).
- PLAN.md updated this session: roadmap item 4 is now this matching model (decoupled from P4
  injection); the `exact`/`index`/`catchAll`-attribute thread is retired; the substrate
  (structured-segments) rewrite is noted as orthogonal and NOT a prerequisite.
- No code changes yet for this model - the spike is the next commit.
