import { Model } from '@expressive/mvc';

import type { Output, Run } from './bin';
import { help, usage } from './help';
import { SPECS } from './input';
import { kebab, parse, Usage } from './parse';

/** A Model class with a `run` method. */
type Root = Model.Type<Model & { run(): unknown }>;

/**
 * Turn a Model class into a command - argv in, exit code out.
 *
 * Its `arg`, `args`, `flag`, `opt` and `list` fields are filled from argv before `new()`; then
 * `run()` is awaited and the instance destroyed. A usage error prints to `out.error` and returns 2;
 * `--help` or `-h` prints help and returns 0. `run` returning `undefined` or `true` gives 0,
 * `false` 1, a number itself; anything else prints to `out.log` and gives 0. A throw prints its
 * message and gives 1. The command name in help is the class name in kebab case.
 *
 * @example
 * export default command(Lint);
 */
function command(Root: Root): Run {
  if (!('run' in Root.prototype)) throw new TypeError(`${Root.name} has no run() method.`);

  const name = kebab(Root.name).replace(/^-/, '');

  return async (argv: string[], out: Output) => {
    let outcome: unknown;

    const instance = Root.new(function (this: Model) {
      try {
        outcome = parse(SPECS.get(this) || [], argv, process.cwd());

        if (outcome !== true) return outcome as {};
      } catch (error) {
        outcome = error;
      }
    });

    try {
      const specs = SPECS.get(instance) || [];

      if (outcome instanceof Error && !(outcome instanceof Usage)) throw outcome;

      if (outcome === true) {
        out.log(help(name, specs));
        return 0;
      }

      if (outcome instanceof Usage) {
        out.error(`${outcome.message}\n${usage(name, specs)}`);
        return 2;
      }

      const result = await instance.run();

      if (result === undefined || result === true) return 0;
      if (result === false) return 1;
      if (typeof result == 'number') return result;

      out.log(result);
      return 0;
    } catch (error) {
      out.error(error instanceof Error ? error.message : String(error));
      return 1;
    } finally {
      instance.set(null);
    }
  };
}

export { command };
