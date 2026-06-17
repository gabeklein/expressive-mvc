#!/usr/bin/env bash
# Capture the current Claude Code login (after `claude auth login`) and store it in
# the CLAUDE_AUTH_ARCHIVE *user* Codespaces secret via gh, so future/fresh Codespaces
# restore it automatically (see restore-claude-auth.sh) with no interactive login.
#
# Run after each `claude auth login` (the stored snapshot goes stale when the
# credential expires, so re-run it whenever you re-authenticate).
#
# gh auth is handled for you: the Codespaces built-in GITHUB_TOKEN is repo-scoped and
# can't write user secrets, so this sets it aside and ensures a stored gh login with
# the 'codespace' scope (you'll complete a one-time web code when prompted).
set -euo pipefail

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/workspaces/.claude}"
SECRET="CLAUDE_AUTH_ARCHIVE"

if [ ! -f "$CONFIG_DIR/.credentials.json" ]; then
  echo "No credentials at $CONFIG_DIR/.credentials.json — run 'claude auth login' first." >&2
  exit 1
fi

ensure_gh_user_secret_auth() {
  if [ -n "${GITHUB_TOKEN:-}${GH_TOKEN:-}" ]; then
    echo "[gh] Ignoring the environment GitHub token (can't write user secrets)."
    unset GITHUB_TOKEN GH_TOKEN
  fi
  if gh auth status -h github.com 2>&1 | grep -q "codespace"; then
    return 0
  fi
  if gh auth status -h github.com >/dev/null 2>&1; then
    echo "[gh] Adding the 'codespace' scope to your existing gh login..."
    gh auth refresh -h github.com -s codespace
  else
    echo "[gh] Logging in to gh (open the URL, enter the code)..."
    gh auth login -h github.com -p https -s codespace -w
  fi
  # `gh auth login -s` can reuse an existing authorization without granting the new
  # scope (then the user-secrets API 401s). Verify and force a refresh if needed.
  if ! gh auth status -h github.com 2>&1 | grep -q "codespace"; then
    echo "[gh] Ensuring the 'codespace' scope (one more code)..."
    gh auth refresh -h github.com -s codespace
  fi
}

ensure_gh_user_secret_auth

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

# Derive owner/repo from the git remote (no API call, so it works regardless of gh
# token state); fall back to gh if needed.
repo="$(git config --get remote.origin.url 2>/dev/null \
  | sed -E 's#^(https://github\.com/|git@github\.com:)##; s#\.git$##')"
[ -z "$repo" ] && repo="$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"
repos_flag=()
if [ -n "$repo" ]; then
  repos_flag=(--repos "$repo")
else
  echo "WARNING: couldn't determine the repo; the user secret may need --repos scoping." >&2
fi

printf '%s' "$archive" | gh secret set "$SECRET" --user --app codespaces "${repos_flag[@]}"
echo "Stored $SECRET (${#archive} bytes)${repo:+, scoped to $repo}."
echo "New Codespaces will restore this login on create. Re-run 'sync-claude-auth' after each 'claude auth login'."
echo "To revoke: 'gh secret delete $SECRET --user --app codespaces' (and consider re-logging in)."
