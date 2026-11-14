# @expressive/cli

## 0.1.0

### Minor Changes

- [#704](https://github.com/gabeklein/expressive/pull/704) [`8a5138a`](https://github.com/gabeklein/expressive/commit/8a5138abab19ec9dc3df5277578f93642532a7cc) `sub()` routes subcommands by name - a class, a lazy loader or an inline command. Every class on the path is filled from argv before any `new()`; options may follow any level, and a name shared across levels is one option. `run()` waits for the path to be ready, and usage errors and `--help` abort before `new()`.

### Patch Changes

- Updated dependencies [[`b7be047`](https://github.com/gabeklein/expressive/commit/b7be047c229a1bcaeb7906b660261e2b64edc584)]:
  - @expressive/mvc@0.94.5
