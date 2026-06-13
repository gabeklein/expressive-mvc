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
   - Non-blocking signals: BRANCH.md reminder (warning while the file
     exists - it stays reviewable in the PR; blocking enforcement was
     considered and deferred: always-blocking means red checks for a PR's
     whole life, draft-gating hides the file from review-ready PRs, and a
     merge queue - the one mechanism where reviewable + green + never-on-main
     all hold - is more apparatus than wanted for now); `changeset status`
     (zero-changeset PRs are legitimate); per-package `npm publish --dry-run`
     pack validation for mvc + react.
   - Backstop: `ci:version` deletes any BRANCH.md/PLAN.md that reached main,
     so a missed reminder is bounded by the next release commit.
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
