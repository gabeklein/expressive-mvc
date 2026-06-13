# CI/CD Workflow Overview

## pr.yml (pull requests -> main)

Blocking: `bun run test`, `bun run build`. The frozen-lockfile install in the
`setup` action doubles as the internal-dependency desync guard - a workspace
version that falls outside a sibling's range cannot reach main.

Non-blocking signals: a warning while `BRANCH.md`/`PLAN.md` exists (branch
plans stay reviewable in the PR but are migrated + deleted near merge;
`ci:version` sweeps any stragglers from main), `changeset status` (PRs may
legitimately carry zero changesets), and `npm publish --dry-run` pack
validation for the publishable packages.

## release.yml (push -> main)

`changesets/action` maintains the "Version Packages" PR (`changeset version`
+ `bun install` so the lockfile stays consistent with the bumps). Merging that
PR builds the packages and runs `changeset publish`.

Publishing authenticates via npm OIDC trusted publishing - no token secrets.
Each published package's npm settings trust this exact workflow filename under
the GitHub `release` environment (deployment branches restricted to `main`).
Renaming this file breaks every npm-side config. `changeset publish` skips
versions already on the registry, so re-running a failed job completes a
partial release.

First publish of a new package cannot use OIDC (npm requires the package to
exist before a trusted publisher attaches) - publish a stub manually, attach
the trusted publisher, then release normally.
