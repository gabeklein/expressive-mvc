# Dev Container

Bun-based development container for `expressive-mvc`. Bun is the runtime and
package manager for the project; Node is intentionally absent.
[Claude Code](https://docs.claude.com/en/docs/claude-code) is preinstalled via its
native installer (a standalone binary, no Node required) so you can run it inside
the container and drive it remotely from the Claude app.

## Goal: pair-program from the Claude app via Remote Control

[Remote Control](https://code.claude.com/docs/en/remote-control) lets the Claude
app (mobile/desktop) or claude.ai/code attach to a `claude` session running in this
container. Code execution and file access stay in the container; the app connects
over an **outbound HTTPS tunnel** through Anthropic — no inbound ports are opened,
so nothing needs to be forwarded.

**This starts automatically.** On every container start (cold and warm),
`postStartCommand` runs [`start-remote-control.sh`](./start-remote-control.sh),
which launches `claude remote-control` in a detached `tmux` session named
`claude-rc`. So once the Codespace is running — even if you started it from a phone
browser or the GitHub API — the session registers itself and appears in the Claude
app session list (tap **Code**); no need to be at the machine.

To view the session URL/QR code, or to complete a one-time first-run prompt:

```bash
tmux attach -t claude-rc     # Ctrl-b then d to detach
```

The session lives only as long as the container is running. Codespaces auto-suspend
when idle, which ends the session until the next start (when it relaunches).

> **First run on a brand-new Codespace** may show a one-time "trust this folder"
> prompt. Attach to the tmux session once to accept it; the acceptance persists in
> `~/.claude` for subsequent starts. (This is separate from permissions and is the
> only thing that can block the headless launch.)

### Approving actions

The session runs in the **default** permission mode, so Claude asks before each
tool action and the approval prompts appear **in the Claude app** for you to allow
or deny from your phone/browser — you stay in manual control without being at the
machine. Remote Control supports Ask (default), Accept Edits, and Plan modes; the
`auto` and `bypassPermissions` modes are not available in RC. To start in a
different supported mode, pass e.g. `--permission-mode acceptEdits` in
[`start-remote-control.sh`](./start-remote-control.sh).

### Picking up in-flight work in the editor

Unlike Claude Code on the web (which runs in an Anthropic-managed VM), Remote
Control runs the real `claude` CLI **in this container**, so work you start from
your phone is right here when you open the Codespace in VS Code:

- **File changes** land in the repo working tree (because the launch pins
  `--spawn same-dir`, not an isolated worktree), so they show up live in the editor.
- **The conversation** is stored under `CLAUDE_CONFIG_DIR` (`/workspaces/.claude`),
  the same store the Claude Code extension uses in this container. Resume or read it
  with `claude --resume` in a terminal, or from the extension's session history.

So you can walk away, drive a session from your phone, then jump into the Codespace
and see exactly what's in flight. (Avoid `--spawn worktree` if you want this — it
isolates each remote session in a separate directory. To keep things to a single
session, add `--capacity 1`.)

## Authentication

> **Remote Control requires a claude.ai subscription (OAuth). It does NOT work with
> an API key** — and because `ANTHROPIC_API_KEY` takes auth precedence, do **not**
> set one here or Remote Control will fail. Use the OAuth paths below.

> **Remote Control needs a full-scope interactive login.** The long-lived tokens
> from `claude setup-token` / `CLAUDE_CODE_OAUTH_TOKEN` (and `ANTHROPIC_API_KEY`) are
> **inference-only** and RC rejects them. So those secrets cannot authenticate RC —
> you must `claude auth login` once.

No secret is committed to this repo; each user brings their own login. The flow is
the same in a Codespace and a local dev container:

1. Start the container and open a terminal.
2. Log in (full-scope OAuth — works headless via a URL + code):
   ```bash
   claude auth login
   ```
3. Re-run the autostart (or just `claude remote-control`):
   ```bash
   bash .devcontainer/start-remote-control.sh
   ```

`CLAUDE_CONFIG_DIR` is set to **`/workspaces/.claude`** (see `devcontainer.json`),
so the login is written there instead of `~/.claude`. This matters in Codespaces:
a container **rebuild wipes the home directory and all Docker named volumes** —
only `/workspaces` survives — so storing the config under `/workspaces` is what
keeps the login across **rebuilds**, not just stop/start. `/workspaces/.claude` is a
sibling of the cloned repo, so it's never committed.

So you log in once per Codespace and it persists through stop/start *and* rebuilds.
Only a brand-new Codespace needs the one-time `claude auth login` again. (Tokens
can't substitute here — RC requires the interactive full-scope login.)

The autostart script strips `CLAUDE_CODE_OAUTH_TOKEN` / `ANTHROPIC_API_KEY` from
RC's environment (via `env -u`) so that — even if one is set as a Codespaces secret
for other inference use — it can't shadow the full-scope login RC needs.

> You can't "inherit" your host's existing login by mounting `~/.claude`: on macOS
> Claude Code keeps credentials in the **Keychain**, not in a file the Linux
> container can read. The one-time `claude auth login` is the low-friction
> equivalent.
>
> Note: `/workspaces` is Codespaces' persistent disk. In a **local** dev container
> it lives in the (ephemeral) container, so a local *rebuild* would still require
> re-login; local *stop/start* is unaffected. This setup is optimized for the
> Codespaces-primary workflow.

### Carrying your login to fresh Codespaces (optional)

A brand-new Codespace starts with an empty `/workspaces`, so by default it needs a
one-time `claude auth login`. If you spin up new Codespaces often, you can snapshot
your login into a **user Codespaces secret** and have new Codespaces restore it
automatically:

1. In a logged-in Codespace, snapshot the current login into the `CLAUDE_AUTH_ARCHIVE`
   secret:
   ```bash
   bash .devcontainer/sync-claude-auth.sh
   ```
   The script handles `gh` auth for you — the built-in Codespaces `GITHUB_TOKEN` is
   repo-scoped and can't write user secrets, so it sets that token aside and ensures
   a `gh` login with the `codespace` scope (complete the one-time web code when
   prompted). It then stores a base64 tar.gz of `.credentials.json` (auth) plus
   `.claude.json` (folder trust + the Remote Control confirmation), scoped to this
   repo.
2. New Codespaces auto-restore it: `postCreateCommand` runs
   [`restore-claude-auth.sh`](./restore-claude-auth.sh), which unpacks the secret
   into `CLAUDE_CONFIG_DIR` **only if there's no existing login** (it never clobbers
   a live one). RC then comes up authenticated and trusted with no prompts.

Caveats:

- **The snapshot goes stale.** Claude Code's OAuth credential expires and isn't
  silently refreshed, so when it lapses, `claude auth login` again and **re-run
  `sync-claude-auth.sh`** to refresh the secret.
- **Updating the secret only affects *future* Codespaces** — secrets are injected at
  start, not mid-session.
- **48 KB secret limit.** If `.claude.json` grows too large, `sync-claude-auth.sh`
  errors; drop `.claude.json` from it to store credentials only (you'll then
  re-accept trust + the RC prompt once per fresh Codespace).
- **Security.** This stores a full-scope login (capable of opening Remote Control
  sessions) in a Codespaces secret. Treat it like a credential: keep it scoped to
  this repo, and to revoke run
  `gh secret delete CLAUDE_AUTH_ARCHIVE --user --app codespaces` and re-login.

## Notes

- Remote Control requires a **claude.ai subscription** and a full-scope login (not a
  token/API key). It does not work with `ANTHROPIC_API_KEY`.
- Remote Control needs outbound access to `api.anthropic.com:443`; a restrictive
  Codespaces/network egress policy will block it.
- Never hardcode a token or API key into `devcontainer.json`.
