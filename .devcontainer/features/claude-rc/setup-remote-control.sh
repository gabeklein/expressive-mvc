#!/usr/bin/env bash
# One interactive command to set up Remote Control. Run it in a terminal:
#   setup-remote-control
#
# Steps:
#   1. Onboard Claude — login + theme + "trust this folder". `claude auth login`
#      alone only writes credentials; the onboarding/theme/trust state lives in
#      .claude.json and is only produced by actually running Claude, so we launch it.
#   2. (optional) Remember the login for future Codespaces (gh user secret)
#   3. Start Remote Control
#
# Optional: if you don't want Remote Control, you can just skip running this.
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
# Resolve symlinks (this is invoked via /usr/local/bin/setup-remote-control) so we
# find the sibling scripts at their real install location.
SELF="$(readlink -f "${BASH_SOURCE[0]}")"
DIR="$(cd "$(dirname "$SELF")" && pwd)"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/workspaces/.claude}"

if ! command -v claude >/dev/null 2>&1; then
  echo "'claude' not found on PATH." >&2
  exit 1
fi

# 1. Onboard Claude (login + theme + trust) ------------------------------------
# Launch Claude itself (not just `auth login`) so the theme, onboarding-complete and
# folder-trust state all get written to .claude.json — that's what makes RC able to
# start non-interactively, and what the archive captures for future Codespaces.
if [ -f "$CONFIG_DIR/.credentials.json" ] && [ -f "$CONFIG_DIR/.claude.json" ]; then
  echo "==> Step 1/3: Claude already set up."
else
  echo "==> Step 1/3: Launching Claude to finish setup (login, theme, trust)."
  echo "    Complete the prompts, then type /exit (or press Ctrl-C) to continue."
  claude || true
fi

# 2. Optionally persist to a Codespaces secret (handles the gh login) ----------
if [ -n "${CODESPACES:-}" ]; then
  read -r -p "==> Step 2/3: Remember this login for future Codespaces? [y/N] " ans
  if [[ "${ans:-}" =~ ^[Yy] ]]; then
    bash "$DIR/sync-claude-auth.sh"
  else
    echo "    Skipped — run 'sync-claude-auth' anytime to do it later."
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
echo
echo "    If Remote Control asks 'Enable Remote Control?' the first time, attach once"
echo "    to answer it, then re-run 'sync-claude-auth' so the saved snapshot includes"
echo "    that confirmation (subsequent fresh Codespaces then start with no prompts)."
