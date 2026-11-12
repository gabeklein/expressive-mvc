import { def, Model } from '@expressive/mvc';

type Kind = 'arg' | 'args' | 'flag' | 'opt' | 'list' | 'sub';

/** How a raw value is read - paths resolve against the working directory. */
type Type = 'string' | 'number' | 'file' | 'dir' | 'path';

/** Settings every input accepts. */
interface Common {
  /** One line for `--help`. */
  help?: string;
}

/** Settings for an input that takes a value. */
interface Valued<T = any> extends Common {
  /** How to read the raw string - default `number` with a number default, else `string`. */
  type?: Type;
  /** Turn each value into what the field holds - given the string, a path resolved. Throw to reject. */
  parse?: (value: string) => T;
  /** Accept or reject each value - `false` is a usage error naming the input. */
  valid?: (value: any) => boolean;
  /** Allowed extensions for a `file` or `path`, dot included. */
  ext?: readonly string[];
  /** A `file`, `dir` or `path` must exist, as that kind. */
  exists?: boolean;
}

/** Settings for a single value. */
interface Single<T = any> extends Valued<T> {
  /** Value when not given. */
  default?: T;
  /** Missing is a usage error. */
  required?: boolean;
}

/** Settings for several values. */
interface Plural<T = any> extends Valued<T> {
  /** Values when none are given. */
  default?: readonly T[];
  /** Fewest values accepted. */
  min?: number;
  /** Most values accepted. */
  max?: number;
}

/** Settings for a named input. */
interface Named {
  /** One-letter alias - `-p`. */
  short?: string;
}

interface Spec {
  key: string;
  kind: Kind;
  config: Single & Plural & Named & { split?: string };
  target?: Target;
}

/** A command run inline by its parent - no inputs of its own. */
interface Inline {
  /** One line for the parent's `--help`. */
  help?: string;
  /** Runs as the command, called on the parent. */
  run(): unknown;
  prototype?: never;
}

type Loader<T extends Model = Model> = () => Promise<{ default: Model.Type<T> } | Model.Type<T>>;

type Target = Model.Type | Loader | Inline;

type Merge<C extends unknown[]> = C extends [infer H, ...infer R] ? Omit<H, keyof Merge<R>> & Merge<R> : {};

type Value<C> = C extends { parse: (value: string) => infer T }
  ? T
  : C extends { type: 'number' }
    ? number
    : C extends { default: infer D }
      ? Widen<D extends readonly (infer E)[] ? E : D>
      : string;

type Widen<T> = T extends number ? number : string;

type One<C> = C extends { required: true } | { default: {} } ? Value<C> : Value<C> | undefined;

const SPECS = new WeakMap<Model, Spec[]>();

function input(kind: Kind, configs: object[], target?: Target): any {
  const config = Object.assign({}, ...configs);

  return def((key, self) => {
    const specs = SPECS.get(self) || [];

    SPECS.set(self, specs);
    specs.push({ key, kind, config, target });

    const value = config.default;

    return {
      value: kind == 'flag' ? !!value : Array.isArray(value) ? [...value] : kind == 'args' || kind == 'list' ? [] : value
    };
  });
}

/**
 * Positional input - the next operand, in declaration order.
 *
 * Configs merge left to right, so a recipe is a plain object listed first. Optional unless
 * `required` or a `default` is given. A required arg after an optional one throws on parse.
 *
 * @example
 * entry = arg({ type: 'file', exists: true, required: true });
 */
function arg<const C extends Single[]>(...configs: C): One<Merge<C>> {
  return input('arg', configs);
}

/**
 * Remaining positional inputs - every operand after the `arg`s before it.
 *
 * Must be the last positional. `min` and `max` bound the count. `type`, `parse` and `valid` apply
 * to each value.
 *
 * @example
 * files = args({ type: 'file', min: 1 });
 */
function args<const C extends Plural[]>(...configs: C): Value<Merge<C>>[] {
  return input('args', configs);
}

/**
 * Boolean switch - `--name`, `--no-name`, or its `short` grouped with others (`-rf`).
 *
 * Takes no value. Default `false`.
 *
 * @example
 * force = flag({ short: 'f', help: 'overwrite existing files' });
 */
function flag(...configs: (Common & Named & { default?: boolean })[]): boolean {
  return input('flag', configs);
}

/**
 * Named input with one value - `--name value`, `--name=value`, `-n value` or `-nvalue`.
 *
 * Optional unless `required` or a `default` is given. Given twice, the last wins. A `short` may
 * close a group of flags (`-vp 80`).
 *
 * @example
 * port = opt({ short: 'p', type: 'number', default: 3000 });
 */
function opt<const C extends (Single & Named)[]>(...configs: C): One<Merge<C>> {
  return input('opt', configs);
}

/**
 * Named input with several values - the option repeated (`--tag a --tag b`).
 *
 * `split` also divides each value (`--tag a,b`), trimming pieces and dropping empty ones. `min` and
 * `max` bound the count. `type`, `parse` and `valid` apply to each value.
 *
 * @example
 * tags = list({ short: 't', split: ',' });
 */
function list<const C extends (Plural & Named & { split?: string })[]>(
  ...configs: C
): Value<Merge<C>>[] {
  return input('list', configs);
}

/**
 * Subcommand - routed to when the next operand is the field's name in kebab case.
 *
 * Takes a Model class, a loader for one (loaded only when routed to), or an inline command. The
 * field holds the routed child, `true` for an inline one, else `undefined`. `--` ends routing.
 *
 * Options of every class on the routed path are accepted anywhere after their owner's name. A name
 * declared at several levels is one option - the deepest definition reads the value for all. Only the
 * last class on the path takes operands, so a parent's `arg`s fill only for its own `run` or an
 * inline sub. A class with subs and no `run` is a group - run alone it prints help and exits 2.
 *
 * @example
 * sync = sub(Sync, { help: 'apply schema changes' });
 */
function sub<T extends Model>(target: Model.Type<T> | Loader<T>, ...configs: Common[]): T | undefined;

/**
 * Inline subcommand - `run` is the command, called on the parent, with no inputs of its own.
 *
 * Operands after its name fill the parent's `arg`s.
 *
 * @example
 * status = sub({ help: 'print status', run: () => console.log(this) });
 */
function sub(target: Inline, ...configs: Common[]): true | undefined;

function sub(target: Target, ...configs: Common[]) {
  return input('sub', [typeof target != 'function' ? { help: target.help } : {}, ...configs], target);
}

declare namespace arg {
  /** Config for {@link arg}. */
  type Config<T = any> = Single<T>;
}

declare namespace args {
  /** Config for {@link args}. */
  type Config<T = any> = Plural<T>;
}

declare namespace opt {
  /** Config for {@link opt}. */
  type Config<T = any> = Single<T> & Named;
}

declare namespace list {
  /** Config for {@link list}. */
  type Config<T = any> = Plural<T> & Named & { split?: string };
}

export { arg, args, flag, opt, list, sub, SPECS };
export type { Spec, Kind, Type, Target, Inline };
