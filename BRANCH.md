# BRANCH: CI - PR checks + changesets release pipeline (Phase 2)

Implements Phase 2 of the changesets migration (#133, see its PLAN.md for the
full design history). Targets main after #133 lands; this PR also inaugurates
the PLAN.md -> BRANCH.md convention rename.

## Scope

1. **`.github/actions/setup`** - slim to bun-only (drop setup-node + the
   registry-url input), add dep cache on `~/.bun/install/cache` keyed by
   `bun.lock`. `bun install --frozen-lockfile` stays - it is the desync guard
   that makes an internal version/range mismatch unable to reach main.
2. **`pr.yml`** (pull_request -> main):
   - `bun run test`, `bun run build` (blocking).
   - Plan/changeset exclusion (blocking): BRANCH.md (or legacy PLAN.md) may
     not coexist with changeset files - changesets are the plan's migrated
     form, so coexistence means a half-finished migration. This gates the
     leak without life-long red checks: plan-without-changesets (all of
     development) is green, and the only red state is immediately
     actionable. `bun run wrap` = changeset authoring + plan deletion in
     one step. (Always-blocking, draft-gating, and merge queue were each
     considered; queue revisitable if zero-changeset PRs leak plans.)
   - Plan-alone warning (non-blocking) + `ci:version` sweep of any plan
     file reaching main cover the zero-changeset path.
   - Other non-blocking signals: `changeset status` (zero-changeset PRs are
     legitimate); per-package `npm publish --dry-run` pack validation.
3. **`release.yml`** (push -> main): `changesets/action@v1` maintains the
   Version Packages PR; on merge, builds and runs `changeset publish`.
   - Auth is OIDC trusted publishing (configured npm-side 2026-06-12 for
     mvc, react, router): `id-token: write` + `environment: release`.
     The GitHub `release` environment must exist with deployment branches
     restricted to `main`.
   - node 24 in this workflow only - npm >= 11.5.1 speaks the OIDC;
     `changeset publish` shells to npm. pr.yml stays bun-only.
   - The version command is `changeset version && bun install` so the
     Version PR commits a lockfile consistent with the bumps - otherwise its
     own frozen-lockfile check would fail.
   - Idempotent recovery: `changeset publish` skips versions already on the
     registry, so re-running the job completes a partial release.
4. **Convention rename**: AGENTS.md `PLAN.md` -> `BRANCH.md` (same rules:
   first commit of the branch, deleted near merge); CI overview updated
   (bun-only checks; node only in release.yml for npm/OIDC); workflows
   README placeholder replaced.

## After merge (manual, one-time)

- Enable branch protection on main requiring the pr.yml check - only after
  it has run green on a real PR.
- Validation release: a deliberate mvc patch changeset. **The inaugural
  release must include mvc** - react's `^0.77.0` dep is unsatisfiable on the
  registry until mvc 0.77.x publishes (see #133 PLAN registry audit).

## Deferred (deliberately out of this PR)

- dist/ build caching keyed on src hash (PLAN's no-repeat-work section) -
  worth doing only if release-time rebuilds become an actual cost.
- Token/whoami preflight - obsolete under OIDC (no pre-publish identity).
- Canary/snapshot releases.
