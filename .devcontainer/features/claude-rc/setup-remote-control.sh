#!/usr/bin/env bash
# One interactive command to set up Remote Control. Run it in a terminal:
#   setup-remote-control
#
# Steps:
#   1. Onboard Claude — login + theme + "trust this folder". `claude auth login`
#      alone only writes credentials; the onboarding/theme/trust state lives in
#      .claude.json and is only produced by actually running Claude, so we launch it.
#   2. Start Remote Control attached, so the first-run "Enable Remote Control?" prompt
#      can be answered (a detached/headless launch can't answer it and just exits).
#   3. (optional) Remember the full setup for future Codespaces (gh user secret).
#
# Optional: if you don't want Remote Control, you can just skip running this.
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
# Resolve symlinks (this is invoked via /usr/local/bin/setup-remote-control) so we
# find the sibling scripts at their real install location.
SELF="$(readlink -f "${BASH_SOURCE[0]}")"
DIR="$(cd "$(dirname "$SELF")" && pwd)"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/workspaces/.claude}"
NAME="${CLAUDE_RC_NAME:-$(basename "$PWD")}"

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

# 2. Start Remote Control ATTACHED ---------------------------------------------
# Attached (not detached) so you can answer the one-time "Enable Remote Control?"
# prompt and watch it connect; it keeps running after you detach.
echo "==> Step 2/3: Starting Remote Control in tmux."
echo "    • If asked 'Enable Remote Control?', answer y."
echo "    • When you see 'Connected', press Ctrl-b then d to detach — it keeps running."
rm -f "$CONFIG_DIR/LOGIN-REQUIRED.md" 2>/dev/null || true
tmux kill-session -t claude-rc 2>/dev/null || true
tmux new-session -A -s claude-rc \
  "env -u CLAUDE_CODE_OAUTH_TOKEN -u ANTHROPIC_API_KEY claude remote-control --spawn same-dir --name '$NAME (codespace)'"

# 3. Optionally persist the now-complete setup to a Codespaces secret -----------
# Done last so the snapshot includes the Remote Control enable you just confirmed.
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
echo "    or reattach to the session with: tmux attach -t claude-rc"
