import { statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

import type { Spec } from './input';

class Usage extends Error {}

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

const isNamed = (spec: Spec) => spec.kind == 'flag' || spec.kind == 'opt' || spec.kind == 'list';
const isPlural = (spec: Spec) => spec.kind == 'args' || spec.kind == 'list';
const isRequired = (spec: Spec) => !!spec.config.required && spec.config.default === undefined;

const valueType = (spec: Spec) =>
  spec.config.type ||
  (typeof spec.config.default == 'number' || typeof spec.config.default?.[0] == 'number' ? 'number' : 'string');

function label(spec: Spec) {
  return isNamed(spec) ? '--' + kebab(spec.key) : `<${kebab(spec.key)}>`;
}

function check(specs: Spec[]) {
  let optional: Spec | undefined;
  let rest: Spec | undefined;

  for (const spec of specs)
    if (spec.kind == 'arg' || spec.kind == 'args') {
      if (rest) throw new Error(`${label(rest)} takes the remaining arguments - ${label(spec)} cannot follow it.`);

      if (spec.kind == 'args') rest = spec;
      else if (!isRequired(spec)) optional = spec;
      else if (optional) throw new Error(`Required ${label(spec)} cannot follow optional ${label(optional)}.`);
    }
}

function read(spec: Spec, raw: string, cwd: string): unknown {
  const { parse, valid, ext, exists } = spec.config;
  const kind = valueType(spec);
  let value: unknown = raw;

  if (kind == 'file' || kind == 'dir' || kind == 'path') {
    const path = resolve(cwd, raw);
    const stat = exists && statSync(path, { throwIfNoEntry: false });

    if (exists && (!stat || (kind == 'file' && !stat.isFile()) || (kind == 'dir' && !stat.isDirectory())))
      throw new Usage(`${label(spec)}: ${kind == 'path' ? 'no such path' : `no such ${kind}`} "${raw}".`);

    if (ext && kind != 'dir' && !ext.includes(extname(path)))
      throw new Usage(`${label(spec)}: "${raw}" must end in ${ext.join(', ')}.`);

    value = path;
  }

  if (parse)
    try {
      value = parse(value as string);
    } catch (error) {
      throw new Usage(`${label(spec)}: ${error instanceof Error ? error.message : error}`);
    }
  else if (kind == 'number') {
    value = raw.trim() ? Number(raw) : NaN;

    if (Number.isNaN(value)) throw new Usage(`${label(spec)}: "${raw}" is not a number.`);
  }

  if (valid && !valid(value)) throw new Usage(`${label(spec)}: invalid value "${raw}".`);

  return value;
}

interface Shared {
  spec: Spec;
  owner: string;
  levels: [number, Spec][];
  raw: string[];
  flag?: boolean;
}

interface Level {
  name: string;
  specs: Spec[];
  operands: string[];
  inline?: boolean;
}

class Reader {
  readonly levels: Level[] = [];
  help = false;

  ended = false;

  private at = 0;
  private long = new Map<string, Shared>();
  private short = new Map<string, Shared>();

  constructor(
    private argv: string[],
    private cwd: string
  ) {}

  enter(specs: Spec[], name = '', owner = name): Spec | undefined {
    check(specs);

    const index = this.levels.length;

    this.levels.push({ name, specs, operands: [] });

    for (const spec of specs) if (isNamed(spec)) this.declare(spec, index, owner);

    return this.scan(true);
  }

  proceed(name: string) {
    const level = this.levels[this.levels.length - 1];

    level.name += ' ' + name;
    level.inline = true;
    this.scan(false);
  }

  private scan(routing: boolean): Spec | undefined {
    const level = this.levels[this.levels.length - 1];
    const { specs } = level;
    const subs = new Map(specs.filter((spec) => spec.kind == 'sub').map((spec) => [kebab(spec.key), spec]));
    const positional = specs.some((spec) => spec.kind == 'arg' || spec.kind == 'args');

    routing &&= subs.size > 0;

    while (this.at < this.argv.length) {
      const token = this.argv[this.at++];

      if (this.ended || token == '-' || token[0] != '-') {
        if (routing && !this.ended) {
          const sub = subs.get(token);

          if (sub) return sub;
          if (!positional) throw new Usage(`Unknown command "${token}".`);
        }

        routing = false;
        level.operands.push(token);
      } else if (token == '--') this.ended = true;
      else this.option(token);
    }
  }

  finish(): Record<string, unknown>[] | true {
    if (this.help) return true;

    const values = this.levels.map(() => ({}) as Record<string, unknown>);
    const leaf = this.levels.length - 1;

    this.levels.forEach(({ specs, operands }, index) => {
      for (const spec of specs)
        if (spec.kind == 'arg' || spec.kind == 'args') {
          if (index == leaf)
            this.put([[index, spec]], values, spec.kind == 'arg' ? operands.splice(0, 1) : operands.splice(0));
        } else if (isNamed(spec)) {
          const shared = this.long.get(kebab(spec.key))!;

          if (shared.spec != spec) continue;

          if (spec.kind != 'flag') this.put(shared.levels, values, shared.raw);
          else if (shared.flag !== undefined)
            for (const [at, own] of shared.levels) values[at][own.key] = shared.flag;
        }

      if (operands.length) throw new Usage(`Unexpected argument "${operands[0]}".`);
    });

    return values;
  }

  private declare(spec: Spec, index: number, owner: string) {
    const name = kebab(spec.key);
    let shared = this.long.get(name);

    if (shared) {
      const { spec: last } = shared;
      const split = (spec: Spec) => (spec.config.split ? `split "${spec.config.split}"` : 'no split');
      const differ = [
        [last.kind, spec.kind],
        [valueType(last), valueType(spec)],
        [split(last), split(spec)]
      ].find(([a, b]) => a != b);

      if (differ)
        throw new Error(`--${name} is declared differently by ${shared.owner} (${differ[0]}) and ${owner} (${differ[1]}).`);

      shared.spec = spec;
      shared.owner = owner;
      shared.levels.push([index, spec]);
    } else this.long.set(name, (shared = { spec, owner, levels: [[index, spec]], raw: [] }));

    const letter = spec.config.short;

    if (!letter) return;

    const other = this.short.get(letter);

    if (other && other != shared)
      throw new Error(`-${letter} is declared by both ${label(other.spec)} and --${name}.`);

    this.short.set(letter, shared);
  }

  private option(token: string) {
    const next = (spec: Spec) => {
      if (this.at >= this.argv.length) throw new Usage(`${label(spec)} needs a value.`);

      return this.argv[this.at++];
    };

    if (token[1] == '-') {
      const split = token.indexOf('=');
      const name = token.slice(2, split < 0 ? undefined : split);
      const inline = split < 0 ? undefined : token.slice(split + 1);
      const shared = this.long.get(name);
      const negated = !shared && name.startsWith('no-') ? this.long.get(name.slice(3)) : undefined;

      if (name == 'help' && !shared) this.help = true;
      else if (negated?.spec.kind == 'flag' && inline === undefined) negated.flag = false;
      else if (!shared) throw new Usage(`Unknown option --${name}.`);
      else if (shared.spec.kind == 'flag') {
        if (inline !== undefined) throw new Usage(`${label(shared.spec)} takes no value.`);

        shared.flag = true;
      } else shared.raw.push(inline === undefined ? next(shared.spec) : inline);

      return;
    }

    for (let j = 1; j < token.length; j++) {
      const letter = token[j];
      const shared = this.short.get(letter);

      if (!shared) {
        if (letter == 'h') {
          this.help = true;
          continue;
        }

        throw new Usage(`Unknown option -${letter}.`);
      }

      if (shared.spec.kind == 'flag') {
        shared.flag = true;
        continue;
      }

      shared.raw.push(token.slice(j + 1) || next(shared.spec));
      break;
    }
  }

  private put(levels: [number, Spec][], values: Record<string, unknown>[], raw: string[]) {
    const [, spec] = levels[levels.length - 1];
    let value: unknown;

    if (spec.kind == 'list' && spec.config.split)
      raw = raw.flatMap((value) => value.split(spec.config.split!).map((piece) => piece.trim()).filter(Boolean));

    for (const [at, own] of levels) {
      if (isPlural(own)) {
        const { min, max, default: fallback } = own.config;

        if (!raw.length && fallback) continue;

        if (min !== undefined && raw.length < min)
          throw new Usage(`${label(own)} needs at least ${min} value${min == 1 ? '' : 's'}.`);

        if (max !== undefined && raw.length > max)
          throw new Usage(`${label(own)} takes at most ${max} value${max == 1 ? '' : 's'}.`);

        if (!raw.length) continue;
      } else if (!raw.length) {
        if (isRequired(own)) throw new Usage(`Missing ${label(own)}.`);

        continue;
      }

      values[at][own.key] = value ??= isPlural(spec)
        ? raw.map((item) => read(spec, item, this.cwd))
        : read(spec, raw[raw.length - 1], this.cwd);
    }
  }
}

export { Reader, valueType, kebab, label, isNamed, isPlural, isRequired, Usage };
