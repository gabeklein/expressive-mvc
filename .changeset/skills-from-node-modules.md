---
"@expressive/mvc": patch
"@expressive/react": patch
"@expressive/dom": patch
"@expressive/inspect": patch
"@expressive/steps": patch
"@expressive/dev": patch
---

Agents read each package's skill straight from `node_modules/@expressive/<pkg>/skills/`, so linking skills in with `skills experimental_sync` is no longer needed. Point an agent at them with a line in `AGENTS.md`, or `npx skills add gabeklein/expressive` for a small skill that says where they are. Skills now name each other in plain text (`expressive-mvc/component.md#props`) instead of linking a side-by-side install, and `@expressive/dev` drops its `skills` field.
