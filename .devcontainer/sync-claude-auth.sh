#!/usr/bin/env bash
# Capture the current Claude Code login (after `claude auth login`) and store it in
# the CLAUDE_AUTH_ARCHIVE *user* Codespaces secret via gh, so future/fresh Codespaces
# restore it automatically (see restore-claude-auth.sh) with no interactive login.
#
# Run this once after each `claude auth login` (the stored snapshot goes stale when
# the credential expires, so re-run it whenever you re-authenticate).
#
# Requires gh authenticated with permission to manage your Codespaces user secrets:
#   gh auth login                              # interactive, pick the right scopes
#   gh auth refresh -h github.com -s codespace # or add the scope to an existing login
set -euo pipefail

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/workspaces/.claude}"
SECRET="CLAUDE_AUTH_ARCHIVE"

if [ ! -f "$CONFIG_DIR/.credentials.json" ]; then
  echo "No credentials at $CONFIG_DIR/.credentials.json — run 'claude auth login' first." >&2
  exit 1
fi

# Archive credentials + trust/RC config (whichever exist).
files=(.credentials.json)
[ -f "$CONFIG_DIR/.claude.json" ] && files+=(.claude.json)
archive="$(tar -czf - -C "$CONFIG_DIR" "${files[@]}" | base64 -w0)"

# Codespaces secrets cap at ~48 KB.
if [ "${#archive}" -gt 48000 ]; then
  echo "Archive is ${#archive} bytes, over the ~48 KB Codespaces secret limit." >&2
  echo "Drop .claude.json from this script to store credentials only (you'll then" >&2
  echo "re-accept folder-trust and the Remote Control prompt once per fresh Codespace)." >&2
  exit 1
fi

repo="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
repos_flag=()
if [ -n "$repo" ]; then
  repos_flag=(--repos "$repo")
else
  echo "WARNING: couldn't determine the repo; the user secret may need --repos scoping." >&2
fi

printf '%s' "$archive" | gh secret set "$SECRET" --user --app codespaces "${repos_flag[@]}"
echo "Stored $SECRET (${#archive} bytes)${repo:+, scoped to $repo}."
echo "New Codespaces will restore this login on create. Re-run after each 'claude auth login'."
echo "To revoke: 'gh secret delete $SECRET --user --app codespaces' (and consider re-logging in)."
