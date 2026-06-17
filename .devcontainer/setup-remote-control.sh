#!/usr/bin/env bash
# One interactive command to set up Remote Control. Run it in a terminal:
#   bash .devcontainer/setup-remote-control.sh
#
# It wraps the two interactive logins and the launch:
#   1. Claude  — full-scope `claude auth login` (required for Remote Control)
#   2. GitHub  — optional: remember the login for future Codespaces (gh user secret)
#   3. Start Remote Control
#
# Optional: if you don't want Remote Control, you can just skip running this.
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/workspaces/.claude}"

if ! command -v claude >/dev/null 2>&1; then
  echo "'claude' not found on PATH." >&2
  exit 1
fi

# 1. Claude login (full-scope) -------------------------------------------------
if [ -f "$CONFIG_DIR/.credentials.json" ]; then
  echo "==> Step 1/3: Already logged in to Claude."
else
  echo "==> Step 1/3: Log in to Claude (a URL + one-time code will appear)."
  claude auth login
fi

# 2. Optionally persist to a Codespaces secret (handles the gh login) ----------
if [ -n "${CODESPACES:-}" ]; then
  read -r -p "==> Step 2/3: Remember this login for future Codespaces? [y/N] " ans
  if [[ "${ans:-}" =~ ^[Yy] ]]; then
    bash "$DIR/sync-claude-auth.sh"
  else
    echo "    Skipped — run 'bash .devcontainer/sync-claude-auth.sh' anytime to do it later."
  fi
else
  echo "==> Step 2/3: Not in a Codespace; skipping the secret sync."
fi

# 3. Start (or restart) Remote Control -----------------------------------------
echo "==> Step 3/3: Starting Remote Control..."
tmux kill-session -t claude-rc 2>/dev/null || true
rm -f "$CONFIG_DIR/LOGIN-REQUIRED.md" 2>/dev/null || true
bash "$DIR/start-remote-control.sh"

echo "==> Done. Open the Code tab in the Claude app (or claude.ai/code), or:"
echo "    tmux attach -t claude-rc"
