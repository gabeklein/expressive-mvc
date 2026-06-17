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
# When no login can be established, writes a short markdown guide (LOGIN-REQUIRED.md)
# that VS Code opens, rendered, on attach (see devcontainer.json). When a login is
# present, that guide is removed.
#
# Safe + idempotent: never clobbers a live login; a no-op when the secret is unset
# (e.g. local containers).
set -euo pipefail

CONFIG_DIR="${CLAUDE_CONFIG_DIR:-/workspaces/.claude}"
GUIDE="$CONFIG_DIR/LOGIN-REQUIRED.md"

clear_guide() { rm -f "$GUIDE" 2>/dev/null || true; }

write_guide() {
  mkdir -p "$CONFIG_DIR"
  cat > "$GUIDE" <<'MD'
# Claude Code — finish logging in

This Codespace has no Claude Code login yet, so **Remote Control** can't start.
Remote Control needs a full-scope `claude auth login` (long-lived tokens are
inference-only and rejected).

> **This is optional.** If you don't need Remote Control, just **close this file** —
> the Codespace works normally without it. Follow the steps below only if you want to
> drive this Codespace from the Claude app.

## Finish it in the waiting session

Remote Control is already waiting for you to log in. Attach to it, complete the
login (a URL + one-time code appears), and the session starts automatically:

```bash
tmux attach -t claude-rc
```

Then open the **Code** tab in the Claude app (or claude.ai/code) and pick the
`expressive-mvc (codespace)` session. Detach from tmux with `Ctrl-b` then `d`.

## Skip this on future Codespaces (optional)

Snapshot the login into a user Codespaces secret so new Codespaces restore it
automatically:

```bash
bash .devcontainer/sync-claude-auth.sh
```

(You can close this file once you're logged in.)
MD
}

if [ -f "$CONFIG_DIR/.credentials.json" ]; then
  echo "[claude-auth] Existing login in $CONFIG_DIR; leaving it untouched."
  clear_guide
  exit 0
fi

if [ -z "${CLAUDE_AUTH_ARCHIVE:-}" ]; then
  echo "[claude-auth] No CLAUDE_AUTH_ARCHIVE secret; a login is needed (see LOGIN-REQUIRED.md)."
  write_guide
  exit 0
fi

mkdir -p "$CONFIG_DIR"
if echo "$CLAUDE_AUTH_ARCHIVE" | base64 -d 2>/dev/null | tar -xzf - -C "$CONFIG_DIR" 2>/dev/null; then
  chmod 600 "$CONFIG_DIR/.credentials.json" 2>/dev/null || true
  echo "[claude-auth] Restored login from CLAUDE_AUTH_ARCHIVE into $CONFIG_DIR."
  clear_guide
else
  echo "[claude-auth] WARNING: could not decode/extract CLAUDE_AUTH_ARCHIVE; a login is needed." >&2
  write_guide
fi
