#!/usr/bin/env bash
# Restore a Claude Code login from the CLAUDE_AUTH_ARCHIVE Codespaces secret into
# CLAUDE_CONFIG_DIR on container create, so a brand-new Codespace comes up already
# authenticated for Remote Control (which requires a full-scope `claude auth login`
# and rejects long-lived tokens).
#
# CLAUDE_AUTH_ARCHIVE is a base64'd tar.gz of .credentials.json (auth) and
# .claude.json (folder trust + the "Enable Remote Control?" confirmation), produced
# by `sync-claude-auth` after you `claude auth login`.
#
# When no login can be established, writes a short markdown guide (LOGIN-REQUIRED.md)
# that VS Code opens, rendered, on attach. When a login is present, it's removed.
#
# Safe + idempotent: never clobbers a live login; a no-op when the secret is unset.
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
> the Codespace works normally without it. Run the command below only if you want to
> drive this Codespace from the Claude app.

## One command does it all

In a terminal, run:

```bash
setup-remote-control
```

It walks you through everything:

1. **Finish Claude setup** — login + theme + "trust this folder" (a URL + one-time
   code appears for login).
2. **Remember it for future Codespaces?** — optional; if yes, it stores your login in
   a user Codespaces secret and handles the one-time GitHub (`gh`) authorization for
   you.
3. **Starts Remote Control** — then open the **Code** tab in the Claude app (or
   claude.ai/code) and pick the session (named after this folder).

(You can close this file at any time.)
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
if echo "$CLAUDE_AUTH_ARCHIVE" | base64 -d 2>/dev/null | tar -xzf - -C "$CONFIG_DIR" 2>/dev/null \
   && [ -f "$CONFIG_DIR/.credentials.json" ]; then
  chmod 600 "$CONFIG_DIR/.credentials.json" 2>/dev/null || true
  if [ -f "$CONFIG_DIR/.claude.json" ]; then
    echo "[claude-auth] Restored login + settings from CLAUDE_AUTH_ARCHIVE into $CONFIG_DIR."
  else
    echo "[claude-auth] WARNING: archive had credentials but no .claude.json — onboarding" >&2
    echo "[claude-auth] (theme / trust / Remote Control enable) will still be prompted." >&2
    echo "[claude-auth] Recapture a complete snapshot: run 'setup-remote-control', then" >&2
    echo "[claude-auth] 'sync-claude-auth'." >&2
  fi
  clear_guide
else
  echo "[claude-auth] WARNING: could not decode/extract CLAUDE_AUTH_ARCHIVE; a login is needed." >&2
  write_guide
fi
