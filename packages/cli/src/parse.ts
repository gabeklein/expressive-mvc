import { statSync } from 'node:fs';
import { extname, resolve } from 'node:path';

import type { Spec } from './input';

class Usage extends Error {}

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

const isNamed = (spec: Spec) => spec.kind == 'flag' || spec.kind == 'opt' || spec.kind == 'list';
const isPlural = (spec: Spec) => spec.kind == 'args' || spec.kind == 'list';
const isRequired = (spec: Spec) => spec.config.required && spec.config.default === undefined;

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
  const { type, parse, valid, ext, exists, default: fallback } = spec.config;
  const kind = type || (typeof fallback == 'number' || typeof fallback?.[0] == 'number' ? 'number' : 'string');
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

/**
 * Read argv against an instance's inputs - values to assign, or `true` when help was asked for.
 *
 * Throws {@link Usage} for input the command does not accept, and `Error` for inputs declared
 * in an order no argv could fill.
 */
function parse(specs: Spec[], argv: string[], cwd: string): Record<string, unknown> | true {
  check(specs);

  const long = new Map<string, Spec>();
  const short = new Map<string, Spec>();
  const given = new Map<Spec, string[]>();
  const operands: string[] = [];
  const values: Record<string, unknown> = {};
  let ended = false;
  let help = false;

  for (const spec of specs)
    if (isNamed(spec)) {
      long.set(kebab(spec.key), spec);

      if (spec.config.short) short.set(spec.config.short, spec);
    }

  const take = (spec: Spec, value: string) => {
    given.set(spec, [...(given.get(spec) || []), value]);
  };

  const next = (spec: Spec, at: number) => {
    if (at >= argv.length) throw new Usage(`${label(spec)} needs a value.`);

    return argv[at];
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];

    if (ended || token == '-' || token[0] != '-') operands.push(token);
    else if (token == '--') ended = true;
    else if (token[1] == '-') {
      const split = token.indexOf('=');
      const name = token.slice(2, split < 0 ? undefined : split);
      const inline = split < 0 ? undefined : token.slice(split + 1);
      const spec = long.get(name);
      const negated = !spec && name.startsWith('no-') ? long.get(name.slice(3)) : undefined;

      if (name == 'help' && !spec) help = true;
      else if (negated?.kind == 'flag' && inline === undefined) values[negated.key] = false;
      else if (!spec) throw new Usage(`Unknown option --${name}.`);
      else if (spec.kind == 'flag') {
        if (inline !== undefined) throw new Usage(`${label(spec)} takes no value.`);

        values[spec.key] = true;
      } else take(spec, inline === undefined ? next(spec, ++i) : inline);
    } else
      for (let j = 1; j < token.length; j++) {
        const letter = token[j];
        const spec = short.get(letter);

        if (!spec) {
          if (letter == 'h') {
            help = true;
            continue;
          }

          throw new Usage(`Unknown option -${letter}.`);
        }

        if (spec.kind == 'flag') {
          values[spec.key] = true;
          continue;
        }

        take(spec, token.slice(j + 1) || next(spec, ++i));
        break;
      }
  }

  if (help) return true;

  for (const spec of specs) {
    if (spec.kind == 'arg' && operands.length) take(spec, operands.shift()!);
    else if (spec.kind == 'args') given.set(spec, operands.splice(0));

    if (spec.kind == 'flag') continue;

    let raw = given.get(spec) || [];

    if (spec.kind == 'list' && spec.config.split)
      raw = raw.flatMap((value) => value.split(spec.config.split!).map((piece) => piece.trim()).filter(Boolean));

    if (isPlural(spec)) {
      const { min, max } = spec.config;

      if (!raw.length && spec.config.default) continue;

      if (min !== undefined && raw.length < min)
        throw new Usage(`${label(spec)} needs at least ${min} value${min == 1 ? '' : 's'}.`);

      if (max !== undefined && raw.length > max)
        throw new Usage(`${label(spec)} takes at most ${max} value${max == 1 ? '' : 's'}.`);

      values[spec.key] = raw.map((value) => read(spec, value, cwd));
    } else if (raw.length) values[spec.key] = read(spec, raw[raw.length - 1], cwd);
    else if (isRequired(spec)) throw new Usage(`Missing ${label(spec)}.`);
  }

  if (operands.length) throw new Usage(`Unexpected argument "${operands[0]}".`);

  return values;
}

export { parse, kebab, label, isNamed, isPlural, isRequired, Usage };
