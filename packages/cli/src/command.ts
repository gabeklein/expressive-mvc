import { Model } from '@expressive/mvc';

import type { Output, Run } from './bin';
import { help, usage } from './help';
import { SPECS, type Target } from './input';
import { kebab, Reader, Usage } from './parse';

class Exit extends Error {
  constructor(readonly code: number) {
    super();
  }
}

class Miss extends Error {
  constructor(
    readonly loader: () => Promise<unknown>,
    readonly cache: Map<string, Model.Type>,
    readonly key: string
  ) {
    super();
  }
}

/**
 * Turn a Model class into a command - argv in, exit code out.
 *
 * Its `arg`, `args`, `flag`, `opt` and `list` fields are filled from argv before `new()`. A `sub`
 * named in argv is created in turn - every class on the routed path, outermost first, each filled
 * before any `new()` runs. The last one's `run()` is awaited, then the path is destroyed. A usage
 * error prints to `out.error` and returns 2; `--help` or `-h` prints help for the path and returns
 * 0. `run` returning `undefined` or `true` gives 0, `false` 1, a number itself; anything else prints
 * to `out.log` and gives 0. A throw prints its message and gives 1. The command name in help is the
 * class name in kebab case.
 *
 * @example
 * export default command(Lint);
 */
function command(Root: Model.Type): Run {
  const name = kebab(Root.name).replace(/^-/, '');
  const loaded = new Map<Function, Map<string, Model.Type>>();

  return async (argv: string[], out: Output) => {
    for (;;) {
      const reader = new Reader(argv, process.cwd());
      const path: Model[] = [];
      let run!: () => unknown;
      let root: Model | undefined;

      const enter = (named: string) =>
        function (this: Model): any {
          const specs = SPECS.get(this) || [];

          path.push(this);

          const step = reader.enter(specs, named, this.constructor.name);

          if (!step) {
            if (!('run' in this)) {
              if (specs.some((spec) => spec.kind == 'sub')) {
                const [extra] = reader.levels[reader.levels.length - 1].operands;

                if (extra !== undefined) throw new Usage(`Unknown command "${extra}".`);

                throw new Exit(2);
              }

              throw new TypeError(`${this.constructor.name} has no run() method.`);
            }

            finish();
            run = () => (this as Model & { run(): unknown }).run();
            return;
          }

          const target = step.target as Target;

          if (typeof target == 'function') {
            const owner = this.constructor;
            const cache = loaded.get(owner) || loaded.set(owner, new Map()).get(owner)!;
            const Type = target.prototype instanceof Model ? (target as Model.Type) : cache.get(step.key);

            if (!Type) throw new Miss(target as Miss['loader'], cache, step.key);

            return { [step.key]: new Type(enter(kebab(step.key))) };
          }

          reader.proceed(kebab(step.key));
          finish();
          run = () => target.run();

          return { [step.key]: true };
        };

      const finish = () => {
        const values = reader.finish();

        if (values === true) throw new Exit(0);

        path.forEach((level, index) => Object.assign(level, values[index]));
      };

      const shown = () => {
        const names = reader.levels.map((level) => level.name).join(' ');
        const specs = reader.levels.map((level) =>
          level.inline ? level.specs.filter((spec) => spec.kind != 'sub') : level.specs
        );

        return [names, specs, 'run' in path[path.length - 1]] as const;
      };

      try {
        root = Root.new(enter(name));

        const result = await run();

        if (result === undefined || result === true) return 0;
        if (result === false) return 1;
        if (typeof result == 'number') return result;

        out.log(result);
        return 0;
      } catch (error) {
        if (error instanceof Miss) {
          try {
            const module = (await error.loader()) as { default?: Model.Type };

            error.cache.set(error.key, (module.default || module) as Model.Type);
            continue;
          } catch (failed) {
            error = failed;
          }
        }

        if (error instanceof Exit) {
          if (error.code) out.error(help(...shown()));
          else out.log(help(...shown()));

          return error.code;
        }

        if (error instanceof Usage) {
          out.error(`${error.message}\n${usage(...shown())}`);
          return 2;
        }

        out.error(error instanceof Error ? error.message : String(error));
        return 1;
      } finally {
        root?.set(null);
      }
    }
  };
}

export { command };
