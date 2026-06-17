#!/usr/bin/env bash
# Pre-seed the non-secret Claude onboarding flags in .claude.json so a plain
# `claude auth login` is enough to run Remote Control non-interactively — no theme/
# onboarding prompt, no "trust this folder", no "Enable Remote Control?".
#
# These flags are internal/undocumented (observed in a completed setup), so the
# archive/restore path remains the version-proof source of truth; this is a
# best-effort convenience for first-run. Idempotent; merges, never clobbers.
set -euo pipefail

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/workspaces/.claude}"
FILE="$CONFIG_DIR/.claude.json"
PROJECT="${1:-$PWD}"
DIR="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"

runtime=""
for r in bun node; do
  command -v "$r" >/dev/null 2>&1 && { runtime="$r"; break; }
done
if [ -z "$runtime" ]; then
  echo "[preseed] no bun/node available; skipping (Claude may prompt for onboarding)." >&2
  exit 0
fi

mkdir -p "$CONFIG_DIR"
"$runtime" "$DIR/preseed-config.js" "$FILE" "$PROJECT"
echo "[preseed] ensured onboarding/trust/remote flags in $FILE for $PROJECT"
