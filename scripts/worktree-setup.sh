#!/usr/bin/env bash
# Make a freshly-created worktree runnable: install deps (node_modules is not
# shared across worktrees) and carry local, gitignored config over from the
# main checkout. Safe to re-run; only acts when something is missing.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
main="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
cd "$root"

if [ ! -d node_modules ]; then
  echo "→ installing deps…"
  bun install
fi

if [ "$root" != "$main" ]; then
  for f in .claude/launch.json .claude/settings.local.json; do
    if [ -f "$main/$f" ] && [ ! -f "$root/$f" ]; then
      mkdir -p "$(dirname "$root/$f")"
      cp "$main/$f" "$root/$f"
      echo "→ copied $f from main checkout"
    fi
  done
fi

echo "✓ worktree ready: $root"
