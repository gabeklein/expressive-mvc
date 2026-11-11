import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Where a command writes - `console`, or a test double. */
type Output = Pick<Console, 'log' | 'error'>;

/**
 * A command module's default export - argv after the command name in, exit code out.
 *
 * `command(Root)` from `@expressive/cli` returns one.
 */
type Run = (args: string[], out: Output) => Promise<number>;

function scopes(cwd: string) {
  const found: string[] = [];

  for (let dir = cwd; ; dir = dirname(dir)) {
    const scope = join(dir, 'node_modules', '@expressive');

    if (existsSync(scope)) found.push(scope);

    if (dirname(dir) == dir) return found;
  }
}

function manifest(dir: string): { bin?: string | Record<string, string> } | undefined {
  try {
    return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).expressive;
  } catch {
    return;
  }
}

function commands(cwd: string) {
  const found = new Map<string, string>();

  for (const scope of scopes(cwd))
    for (const pkg of readdirSync(scope)) {
      const bin = manifest(join(scope, pkg))?.bin;
      const named = typeof bin == 'string' ? { [pkg]: bin } : bin || {};

      for (const [name, path] of Object.entries(named))
        if (!found.has(name)) found.set(name, join(scope, pkg, path));
    }

  return found;
}

/**
 * Run the `expressive` command named by `args[0]` - exit code out.
 *
 * Commands come from `package.json` `expressive.bin` of every `@expressive/*` package in
 * `node_modules`, from `cwd` upward - nearest first. A string runs as the package name; a record maps
 * names to modules. The module's default export is a {@link Run}. An unknown or missing name lists
 * what is installed to `out.error` and returns 2.
 *
 * @example
 * process.exitCode = await dispatch(process.argv.slice(2), process.cwd(), console);
 */
async function dispatch(args: string[], cwd: string, out: Output): Promise<number> {
  const [name, ...rest] = args;
  const available = commands(cwd);
  const bin = name && available.get(name);

  if (!bin) {
    const list = Array.from(available.keys()).join(', ') || 'none installed';

    out.error(
      `${name ? `No expressive command "${name}".` : 'Usage: expressive <command> ...'} Available: ${list}.`
    );
    return 2;
  }

  const { default: run } = (await import(pathToFileURL(bin).href)) as { default: Run };

  return run(rest, out);
}

export { dispatch };
export type { Output, Run };
