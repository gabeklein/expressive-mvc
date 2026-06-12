# PLAN: Replace lerna with changesets; CI-only publishing

## Goal

Retire lerna entirely. Adopt changesets for independent versioning and
changelog generation, and move publishing out of local machines into CI so
`main` is protected. Keep the toolchain thin, standards-friendly, and turnkey:
bun for tasks + tests, changesets for releases, no turbo.

## Scope decisions (agreed)

- **Published packages:** only `@expressive/mvc` and `@expressive/react`.
- **preact / solid:** stay `private` and `ignore`d by changesets for now.
  Both are intended to go public eventually (solid at its 1.0); config must let
  either flip to public independently without rework.
- **Versioning:** fully independent. No `fixed`/`linked` groups. `react`
  bumps automatically when `mvc` changes (changesets' dependent bump);
  this is expected to taper as `mvc` stabilizes.
- **Changelogs:** nuke all 5 existing CHANGELOG.md (root + 4 packages).
  Changesets regenerates per-package changelogs going forward.
- **Task running:** `bun run --filter='*' <script>` replaces `lerna run`.
  Bun orders by the workspace dependency graph; no turbo needed for 4 packages.

## Latent cleanup folded in

- `preact` deps: stale/mismatched `@expressive/react: ^0.77.0`,
  `@expressive/mvc: ^0.73.1`.
- `solid` dep: stale `@expressive/mvc: ^0.73.1`.
- Only `react` uses `workspace:^`; normalize all internal deps to the
  `workspace:` protocol so changesets and `bun publish` rewrite them uniformly.
- Drop per-package `preversion` npm hooks (CI/changesets owns that lifecycle).

## Phase 1 - Changesets (do first)

1. Remove `lerna` devDep and delete `lerna.json`.
2. Root `package.json` scripts:
   - `test` -> `bun run --filter='*' test`
   - `build` -> `bun run --filter='*' build`
   - add `changeset` -> `changeset`, `version` -> `changeset version`,
     `release` -> publish step (see open question on `bun publish`).
3. Add `@changesets/cli`; run `changeset init`.
4. `.changeset/config.json`:
   - independent versions (no `linked`/`fixed`),
   - `ignore: ["@expressive/preact", "@expressive/solid"]`,
   - `access: "public"`, `baseBranch: "main"`,
   - default `@changesets/changelog-git` (or GitHub generator if we want
     PR/author links - decide during impl).
5. Normalize internal dep ranges to `workspace:*`; fix stale `0.73.1` pins.
6. Delete root + all package CHANGELOG.md.
7. Remove `preversion` hooks from package.json files.
8. Update AGENTS.md (see policy below).

## Phase 2 - CI (contemplated now, built after Phase 1 lands)

- **pr.yml** (on PRs): reuse `.github/actions/setup`; run
  `bun run test` + `bun run build`. Optionally `changeset status --since main`
  as a non-blocking nudge when a PR carries no changeset.
- **release.yml** (on push to `main`): `changesets/action@v1`. Opens/updates
  the "Version Packages" PR; on merge, publishes `mvc` + `react`. Hotfixes
  pushed straight to `main` flow through the same Version PR gate.
- **Auth is OIDC trusted publishing - no NPM_TOKEN exists.** (npm killed
  classic tokens 2025-12-09; granular tokens are 90-day/2FA.) Configured
  2026-06-12 on npmjs.com for both `@expressive/mvc` and `@expressive/react`:
  publisher `gabeklein/expressive-mvc`, workflow `release.yml` (exact-match,
  case-sensitive), environment `release`, allowed action `npm publish` only.
  Consequences for the publish job:
  - `permissions: { id-token: write, contents: read }` and
    `environment: release` - the GitHub environment must exist with
    deployment branches restricted to `main` (publish capability pinned to
    main structurally, not just by `on:` trigger).
  - npm CLI >= 11.5.1 / node >= 22.14 required for OIDC, and
    `changeset publish` shells to npm - so release.yml keeps `setup-node`
    (node 24) alongside bun. Bun-only applies to pr.yml.
  - Provenance attestations are automatic (public repo, no flag).
  - Preflight: drop `npm whoami` (no token identity pre-publish);
    version-exists check + dry-run pack stay.
  - Renaming the workflow file requires updating both npm-side configs.
  - preact/solid/router later: never-published names likely need their
    first publish handled before a trusted publisher can attach.
- **Branch protection** on `main`: require PR checks. This + CI-only publish is
  what actually protects `main`.

### Caching / no-repeat-work

Goal: by the time the Version PR merges, build + coverage are already known-good
and the publish step does not redo them.

- **Dep cache:** `actions/cache` on `~/.bun/install/cache` keyed by `bun.lock`
  hash (fold into the `setup` composite action so every job benefits).
- **Build cache:** cache each package's `dist/` keyed by a content hash of
  `src/**` + `bun.lock` + build config. PR job populates it; the release publish
  job restores it and skips rebuild on a cache hit. Falls back to a clean build
  on miss, so correctness never depends on the cache.
- **Coverage runs only in the PR check**, not in release - publishing doesn't
  need coverage, so don't pay for it twice.

**Carry-forward of PR validation** is achieved the standards-friendly way, not
via bespoke artifact promotion:
- **Tests/coverage:** branch protection (required green checks before merge)
  means only validated commits reach `main`; the release job trusts that and
  does not re-run them. changesets/action's default assumes a green `main`.
- **Build:** the content-hashed `dist/` cache keys on `src` + lockfile, NOT
  version - so the changesets version-bump commit hits the same cache the
  feature PR populated, and release restores instead of rebuilding.
- **Out of scope:** explicit tarball promotion (`npm publish <saved-tarball>`).
  The published artifact is built from the version-bump commit (not the feature
  PR), and feeding prebuilt tarballs fights changesets' orchestration - not
  worth it for this repo. The cache + main-protection combo gets ~all the
  benefit with none of the plumbing.

### Publish preflight + atomicity (never half-publish)

npm has no transactional multi-package publish, so atomicity is approximated by
**validate-all-before-publish-any** plus **idempotent recovery**:

- **Preflight gate at the top of the release publish job** - before publishing
  any package, validate ALL publishable packages and bail out if any would fail:
  1. **Token/auth:** `npm whoami` with `NPM_TOKEN` (read-only, fails fast).
  2. **Version availability:** `npm view <pkg>@<version>` per package; bail if a
     to-be-published version already exists.
  3. **Pack validation:** `bun/npm publish --dry-run` per package (files /
     manifest / access).
  Only after all pass does `changeset publish` run. This shrinks the
  half-published window to "registry rejected mid-sequence despite preflight."
- **Idempotent recovery:** `changeset publish` skips any package whose version
  is already on the registry, so simply re-running the release job completes a
  partially-published release - no manual cleanup. This is the actual safety net.
- **Cheap early signal on PRs:** run the dry-run pack validation (step 3) on
  feature PRs as a non-blocking check, so packaging problems surface long before
  the Version PR. (Token/version checks need `NPM_TOKEN` and only need to be
  authoritative at publish time, so they live in the publish job.)
- **Image:** thin `oven/bun` is the target. NOTE: AGENTS.md currently says CI
  builds run under node (`node --run build`) and the setup action installs both
  bun + node. Decide deliberately whether to drop the node-build requirement to
  get a single thin bun image, or keep dual-runtime.

## AGENTS.md policy (replaces the "under evaluation" placeholder)

- **Named branches over `claude/*`:** when starting actual work, switch from any
  agent-scratch branch (`claude/*`) to a conventional named branch
  (`feat/...`, `fix/...`, `chore/...`) before the first real commit. The
  BRANCH.md first-commit lands on that named branch.
- **Rename the convention `PLAN.md` -> `BRANCH.md`** (see late-stage steps).
  The "first commit of the branch" rule and "delete near merge" rule carry over
  unchanged; only the filename changes.
- **Write a changeset when** a commit or set of commits is a user-facing
  change: new feature, behavior change, API addition, breaking change.
- **No changeset for** internal refactors, test-only changes, or fixes with no
  observable effect. PRs may legitimately carry zero changesets.
- **BRANCH -> release handoff:** near merge, BRANCH.md content migrates into the
  PR summary AND the changeset entries; then BRANCH.md is deleted.
- Add a short "Releasing" subsection describing the Version PR -> merge -> CI
  publish flow.

## Late-stage steps (this PR, near merge)

These run last because they finalize and then enforce the convention rename:

1. **Rename `PLAN.md` -> `BRANCH.md`.** Update every reference in AGENTS.md (and
   any tooling/skills that name `PLAN.md`) to `BRANCH.md`.
2. **Add a CI guard** to pr.yml that **fails the PR check if `BRANCH.md` exists**
   (i.e. wasn't deleted before merge). Simple `test ! -f BRANCH.md` step.
   The guard must treat absence as success so normal PRs pass.
3. **Self-application:** this PR's own BRANCH.md is deleted as the final commit,
   after migrating its content into the PR summary + changeset entries - which
   is also what makes this PR pass its own new guard.

## Open questions - RESOLVED (verified by dry-run probe)

1. **Drop the `workspace:` protocol; use concrete caret ranges + plain
   `changeset publish`.** Verified empirically: `changeset version` leaves
   `workspace:` ranges untouched and `npm pack` (which `changeset publish`
   shells to) ships them verbatim - broken manifest. Rather than a bespoke
   per-package `bun publish` loop, internal deps are plain `^x.y.z`:
   - bun still links workspace packages whose version satisfies the range
     (verified: react resolves mvc via symlink, registry untouched).
   - `changeset version` keeps the ranges in sync with bumps
     (`updateInternalDependencies: patch`), in the same commit - so the
     repo manifest is byte-for-byte what publishes, and stock
     `changeset publish` works (tags + already-published idempotency intact).
   - **Desync guard (must-have, makes local-link drift impossible):** CI
     installs with `bun install --frozen-lockfile`. A version that falls
     outside a sibling's range changes resolution, which changes the
     lockfile, which fails the frozen install - so a desynced pair can
     never reach `main`, and only CI publishes.
2. **Changelog generator: `@changesets/changelog-github`** (PR/author links;
   GITHUB_TOKEN is already present in the Version PR action).
3. **Single thin bun image.** Drop the CI-builds-under-node requirement;
   update AGENTS.md when release.yml lands in Phase 2.

## Registry state (audited 2026-06-12; constrains the first release)

- The 0.77 lineage published under the old name `@expressive/state`
  (latest: 0.77.0); registry react@0.77.0 depends on it. The
  `@expressive/mvc` rename has never been published.
- `@expressive/mvc` on the registry is an older lineage: latest 0.73.1,
  and a `1.0.0` from the 2021 beta era is permanently burned - a future
  real 1.0 must be 1.0.1+ or skip to 2.0.
- Repo react's `@expressive/mvc: ^0.77.0` is unsatisfiable on the registry
  (no 0.77.x exists; 1.0.0 misses the caret). **The inaugural release must
  include an mvc changeset** so mvc 0.77.x and react publish together;
  react alone would ship a broken dep. Phase 2's validation release (a
  deliberate mvc patch changeset) satisfies this naturally.
- preact/solid never published; zeroed to 0.0.0 alongside router.

## Out of scope

- Publishing preact/solid (deferred; config leaves the door open).
- Build caching / turbo.
- Canary/snapshot releases (can add `changeset version --snapshot` later if
  wanted; not required for turnkey).
