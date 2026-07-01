# Dev Container

Bun-based development container for `expressive-mvc`. Bun is the runtime and package
manager for the project; Node is intentionally absent.

[Claude Code](https://docs.claude.com/en/docs/claude-code) + [Remote
Control](https://code.claude.com/docs/en/remote-control) are provided by a **local Dev
Container Feature** at [`features/claude-rc`](./features/claude-rc/),
opted into from `devcontainer.json`:

```jsonc
"features": {
  "ghcr.io/devcontainers/features/github-cli:1": {},
  "./features/claude-rc": {}
}
```

Keeping it as a feature means the process is self-contained and portable — it can be
lifted into a standalone repo and published for reuse. See the
[feature README](./features/claude-rc/README.md) for the full design.

## Remote Control, in short

Drive a `claude` session running **in this container** from the Claude app
(mobile/desktop) or claude.ai/code — work happens here, you steer it from anywhere,
and you can open the Codespace to pick up in-flight work.

- **Auto-starts**: the feature launches Remote Control in a detached `tmux` session
  (`claude-rc`) on every start. `tmux attach -t claude-rc` to view the URL/QR.
- **First time / fresh Codespace**: run **`setup-remote-control`** — one command that
  logs you in to Claude, optionally remembers it for future Codespaces (handles the
  `gh` step), and starts Remote Control. A rendered `LOGIN-REQUIRED.md` opens to point
  you there; it's optional — close it to skip.
- **Approving actions**: runs in **default** permission mode, so prompts appear in the
  Claude app for you to allow/deny remotely.
- **In-flight work**: `--spawn same-dir` keeps remote sessions in the repo tree, and
  the conversation lives under `CLAUDE_CONFIG_DIR` — resume it with `claude --resume`
  or the editor's session history.

## Authentication & persistence

- Remote Control needs a **full-scope `claude auth login`**; long-lived tokens
  (`CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY`) are inference-only and rejected.
- `CLAUDE_CONFIG_DIR=/workspaces/.claude` (set by the feature) keeps the login across
  **rebuilds** — only `/workspaces` survives a Codespaces rebuild.
- **Fresh Codespaces**: opt in with **`sync-claude-auth`**, which stores your login in
  a user Codespaces secret (`CLAUDE_AUTH_ARCHIVE`) so new Codespaces restore it. The
  snapshot goes stale when the credential expires — re-run after re-authenticating.

## Browser automation

Playwright and its Chromium build are baked into the image (`Dockerfile.dev`) so
browser-driven checks — screenshots or end-to-end runs of the examples app — work on
a fresh container with no per-boot download.

- Version is pinned via the `PLAYWRIGHT_VERSION` build arg; use that same version at
  runtime so the CLI matches the baked browser: `bunx playwright@$PLAYWRIGHT_VERSION …`.
- Browsers live in `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` (shared, world-readable),
  not under the bun user's home, so no `playwright install` is needed.
- Drive the examples app against the Vite dev server (`bun run dev` in `examples/`,
  port 5173) — e.g. deep-link the shell to `/apps/<slug>` and interact with the
  example inside its `iframe[title="…"]`.

## Notes

- Remote Control needs outbound access to `api.anthropic.com:443`.
- Never hardcode a token or API key into `devcontainer.json`.
