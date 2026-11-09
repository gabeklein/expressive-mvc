---
'@expressive/mvc': patch
'@expressive/react': patch
'@expressive/router': patch
'@expressive/dom': patch
'@expressive/inspect': patch
'@expressive/rpc': patch
'@expressive/steps': patch
'@expressive/dev': patch
---

Ship each package's agent skill in the package, at `skills/expressive-<pkg>/SKILL.md`, so the docs an agent reads match the installed version. `npx skills experimental_sync` links them into `.claude/skills/` and `.agents/skills/`; `expressive-mvc` holds the core, and each package's skill links its siblings as installed side by side. On expressive.dev the skills move to `/llm/expressive-<pkg>/`, with the old `/llm/` paths redirecting.
