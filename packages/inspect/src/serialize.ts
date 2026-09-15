import { State } from '@expressive/mvc';

const MAX_STRING = 240;
const MAX_ARRAY = 24;
const MAX_KEYS = 40;

export type Address = { target: string; path?: string };

export function parsePath(raw: string): Address {
  const trimmed = raw.trim();
  const dot = trimmed.indexOf('.');
  if (dot <= 0) return { target: trimmed };
  return { target: trimmed.slice(0, dot), path: trimmed.slice(dot + 1) };
}

/** Raw stored entries of a State - never reads through accessors. */
export function entries(state: State): Map<string, unknown> {
  return new Map(state);
}

/** Walk `path` without triggering getters, factories, or suspense. */
export function walk(value: unknown, path?: string): unknown {
  if (!path) return value;
  let cur: unknown = value;
  for (const part of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    if (cur instanceof State) cur = entries(cur).get(part);
    else if (cur instanceof Map) cur = cur.get(part);
    else cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function ref(state: State) {
  return { $ref: String(state), $type: state.constructor.name };
}

/** JSON-safe, size-capped view. Nested States collapse to `$ref`. */
export function serialize(value: unknown, depth = 2): unknown {
  if (value instanceof State) {
    const out: Record<string, unknown> = ref(value);
    for (const [key, child] of [...entries(value)].slice(0, MAX_KEYS))
      out[key] = write(child, depth - 1);
    return out;
  }
  return write(value, depth);
}

function write(value: unknown, depth: number): unknown {
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value);
  if (typeof value === 'string')
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING - 1)}…` : value;
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value !== 'object') return undefined;
  if (value instanceof State) return ref(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: value.message };
  if (typeof (value as PromiseLike<unknown>).then === 'function') return '(pending)';

  const items = list(value);

  if (items) {
    if (depth <= 0) return `[${items.length}]`;
    const out = items.slice(0, MAX_ARRAY).map((row) => write(row, depth - 1));
    if (items.length > MAX_ARRAY) out.push(`…+${items.length - MAX_ARRAY}`);
    return out;
  }

  const pairs = value instanceof Map
    ? [...value].map(([k, v]) => [String(k), v] as const)
    : Object.entries(value);

  if (depth <= 0) return `{${pairs.length}}`;

  const out: Record<string, unknown> = {};
  for (const [key, child] of pairs.slice(0, MAX_KEYS)) {
    if (key === 'is') continue;
    const next = write(child, depth - 1);
    if (next !== undefined) out[key] = next;
  }
  if (pairs.length > MAX_KEYS) out['…'] = pairs.length - MAX_KEYS;
  return out;
}

function list(value: object): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (value instanceof Map) return undefined;
  if (typeof (value as Iterable<unknown>)[Symbol.iterator] === 'function')
    return [...(value as Iterable<unknown>)];
  return undefined;
}
