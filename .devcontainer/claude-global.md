<!--
  Devcontainer-global Claude instructions.

  Source of truth: .devcontainer/claude-global.md (committed).
  Installed to $CLAUDE_CONFIG_DIR/CLAUDE.md by the postCreateCommand in
  devcontainer.json, so it loads for every `claude` invocation in this container.
  Edit the committed file, not the installed copy — a rebuild overwrites the copy.

  This is an environment fact (true only inside this dev image), which is why it
  lives here rather than in the repo's committed AGENTS.md.
-->

# Dev container tooling

## Browser automation is available — use it for frontend changes

Playwright and a matching Chromium build are baked into this image. No
`playwright install` or per-boot download is needed.

- Invoke the CLI at the pinned version so it matches the baked browser:
  `bunx playwright@$PLAYWRIGHT_VERSION …`
- Browsers live in `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright` (shared,
  world-readable).

When you change a frontend/UI feature or an examples app, **verify it in a real
browser with Playwright** — screenshots plus interaction — not just unit tests.
Run the examples against the Vite dev server (`bun run dev` in `examples/`, port
5173): deep-link the shell to `/apps/<slug>` and drive the example inside its
`iframe[title="…"]`. Confirm the change renders and behaves, with no console
errors, before reporting it done.
