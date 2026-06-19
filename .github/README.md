# CI & Release

The monorepo uses [bun](https://bun.sh) workspaces and [changesets](https://github.com/changesets/changesets). Only `@expressive/mvc` and `@expressive/react` publish; `@expressive/preact` is private and ignored by changesets.

## Workflows

- **[pr.yml](workflows/pr.yml)** - runs on pull requests: type-check, tests, and build across packages.
- **[release.yml](workflows/release.yml)** - runs on push to `main`: maintains a "Version Packages" PR (`changeset version`) and, when that PR merges, publishes via `changeset publish`.

## Flow

1. Open a PR. Add a changeset (`bun run changeset`) for any user-facing change.
2. On merge to `main`, `release.yml` opens or updates the **Version Packages** PR with the pending bumps and changelog.
3. Merging the Version Packages PR publishes the updated packages to npm from CI.

See [AGENTS.md](../AGENTS.md) for the full contributor and change-flow guide.
