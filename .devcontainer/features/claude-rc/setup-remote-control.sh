#!/usr/bin/env bash
# One command to set up Remote Control. Run it in a terminal:
#   setup-remote-control
#
# Steps:
#   1. Log in to Claude (credentials) and pre-seed the onboarding flags
#      (hasCompletedOnboarding / folder-trust / remoteDialogSeen) so nothing prompts.
#   2. Start Remote Control (detached — the pre-seeded flags suppress the prompts).
#   3. (optional) Remember the setup for future Codespaces (gh user secret).
#
# Only the Claude login is interactive (a URL + one-time code). Skip running this if
# you don't want Remote Control.
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
SELF="$(readlink -f "${BASH_SOURCE[0]}")"
DIR="$(cd "$(dirname "$SELF")" && pwd)"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/workspaces/.claude}"

if ! command -v claude >/dev/null 2>&1; then
  echo "'claude' not found on PATH." >&2
  exit 1
fi

# 1. Login (credentials) + pre-seed onboarding flags ---------------------------
if [ -f "$CONFIG_DIR/.credentials.json" ]; then
  echo "==> Step 1/3: Already logged in to Claude."
else
  echo "==> Step 1/3: Logging in to Claude (a URL + one-time code will appear)."
  claude auth login
fi
bash "$DIR/preseed-config.sh" "$PWD"

# 2. Start Remote Control (detached) -------------------------------------------
echo "==> Step 2/3: Starting Remote Control..."
rm -f "$CONFIG_DIR/LOGIN-REQUIRED.md" 2>/dev/null || true
tmux kill-session -t claude-rc 2>/dev/null || true
bash "$DIR/start-remote-control.sh"

# 3. Optionally persist for future Codespaces (handles the gh login) -----------
if [ -n "${CODESPACES:-}" ]; then
  read -r -p "==> Step 3/3: Remember this setup for future Codespaces? [y/N] " ans
  if [[ "${ans:-}" =~ ^[Yy] ]]; then
    bash "$DIR/sync-claude-auth.sh"
  else
    echo "    Skipped — run 'sync-claude-auth' anytime to do it later."
  fi
else
  echo "==> Step 3/3: Not in a Codespace; skipping the secret sync."
fi

echo "==> Done. Open the Code tab in the Claude app (or claude.ai/code),"
echo "    or attach to the session with: tmux attach -t claude-rc"
