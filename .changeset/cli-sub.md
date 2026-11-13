---
"@expressive/cli": minor
---

`sub()` routes subcommands by name - a class, a lazy loader or an inline command. Every class on the path is filled from argv before any `new()`; options may follow any level, and a name shared across levels is one option. `run()` waits for the path to be ready, and usage errors and `--help` abort before `new()`.
