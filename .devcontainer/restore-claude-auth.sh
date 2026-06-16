#!/usr/bin/env bash
# Restore a Claude Code login from the CLAUDE_AUTH_ARCHIVE Codespaces secret into
# CLAUDE_CONFIG_DIR on container create, so a brand-new Codespace comes up already
# authenticated for Remote Control (which requires a full-scope `claude auth login`
# and rejects long-lived tokens).
#
# CLAUDE_AUTH_ARCHIVE is a base64'd tar.gz of .credentials.json (auth) and
# .claude.json (folder trust + the "Enable Remote Control?" confirmation), produced
# by sync-claude-auth.sh after you `claude auth login`.
#
# Safe + idempotent: skips if a live login already exists (won't clobber it) or if
# the secret isn't set. On a non-Codespaces / local container the secret is simply
# unset, so this is a no-op.
set -euo pipefail

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/workspaces/.claude}"

if [ -f "$CONFIG_DIR/.credentials.json" ]; then
  echo "[claude-auth] Existing login in $CONFIG_DIR; leaving it untouched."
  exit 0
fi

if [ -z "${CLAUDE_AUTH_ARCHIVE:-}" ]; then
  echo "[claude-auth] No CLAUDE_AUTH_ARCHIVE secret; run 'claude auth login' then sync-claude-auth.sh."
  exit 0
fi

mkdir -p "$CONFIG_DIR"
if echo "$CLAUDE_AUTH_ARCHIVE" | base64 -d 2>/dev/null | tar -xzf - -C "$CONFIG_DIR" 2>/dev/null; then
  chmod 600 "$CONFIG_DIR/.credentials.json" 2>/dev/null || true
  echo "[claude-auth] Restored login from CLAUDE_AUTH_ARCHIVE into $CONFIG_DIR."
  echo "[claude-auth] If it has expired, run 'claude auth login' then sync-claude-auth.sh to refresh."
else
  echo "[claude-auth] WARNING: could not decode/extract CLAUDE_AUTH_ARCHIVE; run 'claude auth login'." >&2
fi
