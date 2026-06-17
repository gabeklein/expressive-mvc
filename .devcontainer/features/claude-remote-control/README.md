# Claude Code Remote Control (Dev Container Feature)

Installs [Claude Code](https://docs.claude.com/en/docs/claude-code) and auto-starts a
[Remote Control](https://code.claude.com/docs/en/remote-control) session in `tmux`, so
you can pair-program with an in-container session from the Claude app (mobile/desktop)
or claude.ai/code — drive it from anywhere, and pick up in-flight work when you open
the container in your editor.

> Currently developed as a **local feature** inside this repo. It's a self-contained
> folder, so it can later be lifted into a standalone repo and published to `ghcr.io`
> for reuse across projects. The files don't change — only the reference form does
> (`./features/claude-remote-control` → `ghcr.io/<owner>/<repo>/claude-remote-control:1`).

## Usage

```jsonc
// .devcontainer/devcontainer.json
"features": {
  "ghcr.io/devcontainers/features/github-cli:1": {},
  "./features/claude-remote-control": {}
}
```

## What it does

- **Installs** the Claude Code native binary (exposed at `/usr/local/bin/claude`) and `tmux`.
- **`containerEnv`**: sets `CLAUDE_CONFIG_DIR=/workspaces/.claude` so the login persists
  across Codespaces rebuilds (only `/workspaces` survives a rebuild).
- **`postCreateCommand`**: creates/owns the config dir and restores a login from the
  `CLAUDE_AUTH_ARCHIVE` Codespaces secret if present (`restore-claude-auth.sh`).
- **`postStartCommand`**: auto-launches Remote Control in a detached `tmux` session
  (`start-remote-control.sh`); if there's no login yet it defers to `setup-remote-control`.
- **`postAttachCommand`** + an editor association: opens a rendered `LOGIN-REQUIRED.md`
  when a login is needed.

## Commands (on PATH inside the container)

- `setup-remote-control` — one interactive command: Claude login → optionally remember
  it for future Codespaces (handles the `gh` login) → start Remote Control.
- `sync-claude-auth` — snapshot the current login into the `CLAUDE_AUTH_ARCHIVE` user
  Codespaces secret (re-run after each `claude auth login`).

## Authentication notes

- Remote Control needs a **full-scope `claude auth login`**; long-lived tokens
  (`CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY`) are inference-only and rejected.
- Persisting across **fresh** Codespaces is opt-in via `sync-claude-auth` (a user
  Codespaces secret). The snapshot goes stale when the credential expires — re-run
  `sync-claude-auth` after re-authenticating.

## Requirements / assumptions

- The remote user has **passwordless `sudo`** (to create `/workspaces/.claude`).
- A Debian/Alpine/Fedora-family base (for the `curl`/`tmux` install).
- For `sync-claude-auth`, the GitHub CLI (`gh`) is available — add the `github-cli`
  feature alongside this one.
