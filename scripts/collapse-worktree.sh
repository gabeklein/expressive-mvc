#!/usr/bin/env bash
# Collapse a worktree back into the MAIN working directory so you can focus on
# it there: removes the worktree and checks its branch out in the main tree.
# No merge/rebase - a pure checkout swap, so there is no conflict to resolve.
#
# From inside the worktree to collapse:  bash scripts/collapse-worktree.sh
# From anywhere, by branch name:          bash scripts/collapse-worktree.sh <branch>
set -euo pipefail

main="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"

if [ $# -ge 1 ]; then
  branch="$1"
  wt="$(git worktree list --porcelain | awk -v b="refs/heads/$1" '
    /^worktree /{w=$2} /^branch /{if ($2==b) {print w; exit}}')"
  [ -n "$wt" ] || { echo "✗ No worktree holds branch '$branch'." >&2; exit 1; }
else
  branch="$(git symbolic-ref --quiet --short HEAD || true)"
  wt="$(git rev-parse --show-toplevel)"
fi

[ -n "${branch:-}" ] || { echo "✗ Could not determine branch to promote." >&2; exit 1; }

if [ "$wt" = "$main" ]; then
  echo "✗ '$branch' is already the main working tree." >&2
  exit 1
fi

if ! git -C "$main" diff --quiet || ! git -C "$main" diff --cached --quiet; then
  echo "✗ Main tree ($main) has uncommitted changes. Commit or stash there first." >&2
  exit 1
fi

cd "$main"
echo "→ removing worktree $wt"
git worktree remove "$wt"

echo "→ switching main tree to $branch"
git switch "$branch"

echo "✓ '$branch' is now checked out in $main"
