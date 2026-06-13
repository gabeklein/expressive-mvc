# CI/CD Workflow Overview

## pr.yml (pull requests -> main)

Blocking: `bun run test`, `bun run build`, and the plan/changeset exclusion -
`BRANCH.md` (or legacy `PLAN.md`) may not coexist with changeset files, since
changesets are the plan's migrated form (`bun run wrap` authors changesets and
deletes the plan in one step). A plan alone only warns, so it stays reviewable
in the PR for its whole life. The frozen-lockfile install in the `setup`
action doubles as the internal-dependency desync guard - a workspace version
that falls outside a sibling's range cannot reach main.

Non-blocking signals: the plan-present warning, `changeset status` (PRs may
legitimately carry zero changesets), and `npm publish --dry-run` pack
validation for the publishable packages. `ci:version` sweeps any plan file
that reaches main regardless.

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
