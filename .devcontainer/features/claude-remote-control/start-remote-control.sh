#!/usr/bin/env bash
# Launches `claude remote-control` in a detached tmux session on container start
# (both cold and warm, via postStartCommand) so the Claude app can attach to this
# environment without anyone being at the machine.
#
# tmux keeps the process alive independently of VS Code; attach to view the session
# URL/QR or check status:  tmux attach -t claude-rc
#
# Idempotent: a no-op if the session is already running. When there's no full-scope
# login yet, it defers to the interactive wrapper rather than launch a failing one.
set -euo pipefail

export PATH="$HOME/.local/bin:$PATH"
SESSION="claude-rc"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/workspaces/.claude}"
NAME="${CLAUDE_RC_NAME:-$(basename "$PWD")}"

if ! command -v claude >/dev/null 2>&1; then
  echo "[remote-control] 'claude' not found on PATH; skipping." >&2
  exit 0
fi

if tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "[remote-control] tmux session '$SESSION' already running."
  exit 0
fi

if [ ! -f "$CONFIG_DIR/.credentials.json" ]; then
  # No full-scope login yet; Remote Control can't start. Defer to the interactive
  # wrapper (login + optional persist + start) rather than launch a failing session.
  echo "[remote-control] No Claude login yet — Remote Control not started."
  echo "[remote-control] Run: setup-remote-control"
  exit 0
fi

# env -u drops the inference-only tokens so RC uses the stored full-scope login.
# --spawn same-dir keeps every remote session in the repo working directory (not an
# isolated git worktree), so edits and session transcripts land where the editor /
# Claude Code extension attached to this container can see and resume them.
tmux new-session -d -s "$SESSION" \
  "env -u CLAUDE_CODE_OAUTH_TOKEN -u ANTHROPIC_API_KEY claude remote-control --spawn same-dir --name '$NAME (codespace)'"

echo "[remote-control] Started tmux session '$SESSION' as '$NAME (codespace)'."
echo "[remote-control] It should appear in the Claude app session list (tap Code)."
echo "[remote-control] View the URL/QR or check status anytime: tmux attach -t $SESSION"
