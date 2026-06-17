#!/usr/bin/env bash
# Dev Container Feature installer: Claude Code (native binary) + tmux, plus the
# Remote Control helper scripts staged at a stable path and exposed on PATH.
set -euo pipefail

REMOTE_USER="${_REMOTE_USER:-root}"
REMOTE_HOME="${_REMOTE_USER_HOME:-/root}"
SHARE_DIR="/usr/local/share/claude-rc"
SRC="$(cd "$(dirname "$0")" && pwd)"

echo "[claude-rc] Installing for user '$REMOTE_USER' (home: $REMOTE_HOME)"

# --- Dependencies: curl + tmux (best-effort across package managers) ----------
pkg_install() {
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update -y
    apt-get install -y --no-install-recommends "$@"
    rm -rf /var/lib/apt/lists/*
  elif command -v apk >/dev/null 2>&1; then
    apk add --no-cache "$@"
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y "$@"
  else
    echo "[claude-rc] WARNING: no supported package manager; install these manually: $*" >&2
  fi
}

need=()
command -v curl >/dev/null 2>&1 || need+=(curl ca-certificates)
command -v tmux >/dev/null 2>&1 || need+=(tmux)
[ "${#need[@]}" -gt 0 ] && pkg_install "${need[@]}"

# --- Claude Code: install as the remote user, then expose on PATH -------------
if [ "$REMOTE_USER" != "root" ] && id "$REMOTE_USER" >/dev/null 2>&1; then
  su - "$REMOTE_USER" -c 'curl -fsSL https://claude.ai/install.sh | bash'
else
  curl -fsSL https://claude.ai/install.sh | bash
fi
if [ -x "$REMOTE_HOME/.local/bin/claude" ]; then
  ln -sf "$REMOTE_HOME/.local/bin/claude" /usr/local/bin/claude
fi

# --- Stage helper scripts at a stable path; expose the user-facing commands ---
install -d "$SHARE_DIR"
install -m 0755 \
  "$SRC/restore-claude-auth.sh" \
  "$SRC/sync-claude-auth.sh" \
  "$SRC/setup-remote-control.sh" \
  "$SRC/start-remote-control.sh" \
  "$SRC/preseed-config.sh" \
  "$SHARE_DIR/"
install -m 0644 "$SRC/preseed-config.js" "$SHARE_DIR/"
ln -sf "$SHARE_DIR/setup-remote-control.sh" /usr/local/bin/setup-remote-control
ln -sf "$SHARE_DIR/sync-claude-auth.sh" /usr/local/bin/sync-claude-auth

echo "[claude-rc] Done. Commands available: setup-remote-control, sync-claude-auth."
