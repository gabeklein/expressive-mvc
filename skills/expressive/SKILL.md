---
name: expressive
description: Locates the docs for Expressive (@expressive/* packages - mvc, react, dom, router, steps, orm and others). Use before writing, refactoring or reviewing code that imports any @expressive package.
---

# Expressive

Each `@expressive/*` package ships its own skill, versioned with the package. Read the skill of every package the task touches before writing code - `expressive-mvc` first, since the others build on it.

A skill named `expressive-<pkg>` lives at:

```text
node_modules/@expressive/<pkg>/skills/expressive-<pkg>/SKILL.md
```

Read it by that exact path - search tools that respect `.gitignore` skip `node_modules`. In a workspace the package may sit in a nested `node_modules`; resolve from the package that depends on it.

Skills reference each other by name - `expressive-mvc/component.md#props` is `component.md` in the `expressive-mvc` skill, at the heading `#props`. A referenced skill is present only when its package is installed.

Not installed yet, or evaluating the library: read `https://expressive.dev/llm/expressive-<pkg>/SKILL.md` - it tracks the latest release, so prefer the local copy once installed.
