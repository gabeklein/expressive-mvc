# feat/cli-commands - `@expressive/cli`

Commands from Models: argv onto fields, one dispatcher for every `expressive` command. Feature PRs target this trunk; it lands on `main` when release-ready. This file does not land on `main`.

`feat/cli` (the Ink-like JSX renderer) is separate and stays as is; it becomes `@expressive/tui` later.

## Shape (agreed 2026-11-11)

- **A command is any Model with `run()`** - no base class, so `Steps` classes work unchanged. `run()` takes no arguments; every input is a field.
- **Inputs:** `arg` (positional), `args` (the rest), `flag` (boolean), `opt` (one value), `list` (several). Each takes config objects only, merged left to right - a recipe is a plain object. Plurality is the instruction, never config.
- **Config:** `help`; `type` (`string`, `number`, `file`, `dir`, `path` - paths resolve against cwd); `parse(value)`, `valid(value) => boolean` per value; `ext`, `exists`; `default`. Singles: `required`. Plurals: `min`, `max`. Named: `short`. `list`: `split`.
- **argv:** commander parity - `--x v`, `--x=v`, `-x v`, `-xv`, flags group (`-rf`), a valued short may close a group, `--no-x` for flags, `--` ends options, a lone `-` is an operand. Options interleave with operands; order is not enforced. A repeated `opt` keeps the last.
- **`command(Root)`** returns the `Run` contract. Fields fill before `new()`; usage error → stderr + usage line, exit 2; `--help`/`-h` → help, exit 0; `run` result → exit code (`undefined`/`true` 0, `false` 1, number itself, other printed, 0); throw → message, 1; instance destroyed after. Name in help: class name in kebab case.
- **`/bin`:** `dispatch(args, cwd, out)` plus `Output`/`Run` types - the existing `expressive.bin` contract, unchanged and mvc-free. Command modules `export default command(Root)`.

## Milestones

1. **Base** - one command, no subcommands. (this branch)
2. **`sub`** - `sub(Class)`, `sub(() => import(...))`, `sub({ run })`; every class on the path instantiated; options float rightward over the path and a name shared across levels is one option. Acceptance: `expressive sql check|sync [--force] <entry>`.
3. **Renderer slots** - `status`, `progress`, `message`, `children`; TTY frame vs piped; Steps defaults.
4. Skill docs + changeset; downstream sql/dev adopt `/bin`.

## Open

- Root description in help (dev supplies JSDoc later).
- Whether `@expressive/cli` declares the `expressive` bin itself - `@expressive/dev` already does, with its own non-dispatching CLI.
- `valid`'s parameter is untyped (`any`) - typing it from `type`/`parse` across merged configs.
