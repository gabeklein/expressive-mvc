#!/bin/bash
# SessionStart hook for Claude Code on the web.
# Mirrors the .devcontainer setup (postCreateCommand: bun install) so that
# tests, type-checks, and builds work in remote cloud sessions.
set -euo pipefail

# Only run in the remote (web) environment; local sessions use the devcontainer.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Bun workspaces + lerna monorepo. A single root install hydrates every package.
# `bun install` (not `--frozen-lockfile`/ci) plays nicely with the cached
# container state and stays idempotent across re-runs.
bun install
