import { Model } from '@expressive/mvc';

const MAX_STRING = 240;
const MAX_ARRAY = 24;
const MAX_KEYS = 40;
const MAX_DEPTH = 2;

/** Per-call overrides for `serialize`/`project` caps - an editor reads leaves uncapped. */
export interface Limits {
  depth?: number;
  string?: number;
  array?: number;
  keys?: number;
}

type Capped = Required<Limits>;

const caps = (limits: Limits = {}): Capped => ({
  depth: limits.depth ?? MAX_DEPTH,
  string: limits.string ?? MAX_STRING,
  array: limits.array ?? MAX_ARRAY,
  keys: limits.keys ?? MAX_KEYS
});

export type Address = { target: string; path?: string };

export function parsePath(raw: string): Address {
  const trimmed = raw.trim();
  const dot = trimmed.indexOf('.');
  if (dot <= 0) return { target: trimmed };
  return { target: trimmed.slice(0, dot), path: trimmed.slice(dot + 1) };
}

/** Raw stored entries of a Model - never reads through accessors. */
export function entries(state: Model): Map<string, unknown> {
  return new Map(state);
}

/** Walk `path` without triggering getters, factories, or suspense. */
export function walk(value: unknown, path?: string): unknown {
  if (!path) return value;
  let cur: unknown = value;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    if (cur instanceof Model)
      cur = part[0] == '_' ? Object.getOwnPropertyDescriptor(cur, part)?.get?.() : entries(cur).get(part);
    else if (cur instanceof Map) cur = cur.get(part);
    else cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function ref(state: Model) {
  return { $ref: String(state), $type: state.constructor.name };
}

/** `true` takes a value as `serialize` would; an object picks keys and descends, applying to each element of a list. */
export type Select = true | { [key: string]: Select };

/** Only the selected keys, read in one synchronous pass - a consistent snapshot. Models keep their `$ref`. */
export function project(value: unknown, select: Select, limits?: Limits): unknown {
  const lim = caps(limits);
  if (select === true || value == null || typeof value !== 'object') return serialize(value, lim);

  const items = value instanceof Model ? undefined : list(value);

  if (items) {
    const out = items.slice(0, lim.array).map((row) => project(row, select, lim));
    if (items.length > lim.array) out.push(`…+${items.length - lim.array}`);
    return out;
  }

  const out: Record<string, unknown> = value instanceof Model ? ref(value) : {};
  for (const key in select) out[key] = project(walk(value, key), select[key], lim);
  return out;
}

/** JSON-safe, size-capped view. Nested Models collapse to `$ref`. */
export function serialize(value: unknown, limits?: Limits | number): unknown {
  const lim = typeof limits === 'number' ? caps({ depth: limits }) : caps(limits);

  if (value instanceof Model) {
    const out: Record<string, unknown> = ref(value);
    for (const [key, child] of [...entries(value)].slice(0, lim.keys))
      out[key] = write(child, lim.depth - 1, lim);
    return out;
  }
  return write(value, lim.depth, lim);
}

function write(value: unknown, depth: number, lim: Capped): unknown {
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'string')
    return value.length > lim.string ? `${value.slice(0, lim.string - 1)}…` : value;
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value !== 'object') return undefined;
  if (value instanceof Model) return ref(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof (value as PromiseLike<unknown>).then === 'function') return '(pending)';

  const items = list(value);

  if (items) {
    if (depth <= 0) return `[${items.length}]`;
    const out = items.slice(0, lim.array).map((row) => write(row, depth - 1, lim));
    if (items.length > lim.array) out.push(`…+${items.length - lim.array}`);
    return out;
  }

  const pairs = value instanceof Map
    ? [...value].map(([k, v]) => [String(k), v] as const)
    : Object.entries(value);

  if (depth <= 0) return `{${pairs.length}}`;

  const out: Record<string, unknown> = {};
  for (const [key, child] of pairs.slice(0, lim.keys)) {
    if (key === 'is') continue;
    const next = write(child, depth - 1, lim);
    if (next !== undefined) out[key] = next;
  }
  if (pairs.length > lim.keys) out['…'] = pairs.length - lim.keys;
  return out;
}

function list(value: object): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (value instanceof Map) return undefined;
  if (typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function')
    return [...(value as Iterable<unknown>)];
  return undefined;
}
