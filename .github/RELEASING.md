# CI & Release

The monorepo uses [bun](https://bun.sh) workspaces and [changesets](https://github.com/changesets/changesets). `@expressive/preact` is private and ignored by changesets.

## Workflows

- **[pr.yml](workflows/pr.yml)** - runs on pull requests: type-check, tests, and build across packages.
- **[release.yml](workflows/release.yml)** - runs on push to `main`: maintains a "Version Packages" PR (`changeset version`) and, when that PR merges, publishes via `changeset publish`.

## Flow

1. Open a PR. Add a changeset (`bun run changeset`) for any user-facing change.
2. On merge to `main`, `release.yml` opens or updates the **Version Packages** PR with the pending bumps and changelog.
3. Merging the Version Packages PR publishes the updated packages to npm from CI.

Published packages with a peer dependency on a pre-1.0 workspace package must
accept its next minor version, for example `>=0.84.3 <1`. A caret range such as
`^0.84.3` excludes `0.85.0`; Changesets treats an out-of-range internal peer
update as a major release of the dependent package. PR CI enforces this rule.

See [AGENTS.md](../AGENTS.md) for the full contributor and change-flow guide.
