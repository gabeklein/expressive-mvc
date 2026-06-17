#!/usr/bin/env bash
# Launches `claude remote-control` in a detached tmux session on container start
# (both cold and warm, via postStartCommand) so the Claude app can attach to this
# environment without anyone being at the machine.
#
# tmux keeps the process alive independently of VS Code and lets you attach to view
# the session URL/QR code or complete a one-time first-run prompt:
#   tmux attach -t claude-rc
#
# Idempotent: if the session is already running, this is a no-op.
#
# Auth note: Remote Control needs a FULL-SCOPE interactive login. The long-lived
# CLAUDE_CODE_OAUTH_TOKEN / ANTHROPIC_API_KEY (e.g. from a Codespaces secret) are
# inference-only and RC rejects them, so we strip them from RC's environment and
# rely on a `claude auth login` persisted in the ~/.claude volume. Run that once:
#   claude auth login
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
SESSION="claude-rc"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/workspaces/.claude}"

if ! command -v claude >/dev/null 2>&1; then
  echo "[remote-control] 'claude' not found on PATH; skipping." >&2
  exit 0
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "[remote-control] tmux session '$SESSION' already running."
  exit 0
fi

# env -u drops the inference-only tokens so RC uses the stored full-scope login.
# --spawn same-dir keeps every remote session in the repo working directory (not an
# isolated git worktree), so edits and session transcripts land where the editor /
# Claude Code extension attached to this container can see and resume them.
RC="env -u CLAUDE_CODE_OAUTH_TOKEN -u ANTHROPIC_API_KEY claude remote-control --spawn same-dir --name 'expressive-mvc (codespace)'"

if [ -f "$CONFIG_DIR/.credentials.json" ]; then
  # Authenticated: start Remote Control directly.
  launch="$RC"
else
  # No login yet: run the interactive login first, in the session, then start RC.
  # Attaching to the session shows the login URL/code; RC starts once you finish.
  launch="echo '>>> Claude login needed for Remote Control — complete the prompt below.'; claude auth login && $RC"
fi

tmux new-session -d -s "$SESSION" "$launch"

echo "[remote-control] Started tmux session '$SESSION'."
if [ -f "$CONFIG_DIR/.credentials.json" ]; then
  echo "[remote-control] It should appear in the Claude app session list (tap Code)."
else
  echo "[remote-control] Not logged in yet — attach to finish login, then RC starts:"
  echo "[remote-control]   tmux attach -t $SESSION"
  echo "[remote-control] Afterwards, 'bash .devcontainer/sync-claude-auth.sh' remembers it for future Codespaces."
fi
echo "[remote-control] View the URL/QR or check status anytime: tmux attach -t $SESSION"

