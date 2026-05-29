# CI/CD Workflow Overview

> **Status:** CI is intentionally empty pending the lerna → changesets migration.
>
> The previous lerna-driven `pr.yml` / `publish.yml` (and `scripts/canary.sh`)
> were removed because their version-preview and publish jobs depended on lerna,
> which is being replaced. A new workflow set (build/test + changesets release-PR
> + canary snapshot) will land alongside the changesets PR.
>
> The `.github/actions/setup` composite action stays in place since it's
> tool-agnostic (bun + node + install). The `.github/scripts/pr.sh` helper also
> stays since it only opens PRs via `gh`.
