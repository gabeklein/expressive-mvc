/**
 * The wire's values: JSON, plus what JSON loses, as one-key tagged objects -
 * `{ "$date": iso }`, `{ "$bigint": digits }`, `{ "$number": "NaN" }`, `{ "$map": [[k, v]] }`,
 * `{ "$set": [v] }`, `{ "$binary": base64 }` and, in an array, `{ "$undefined": 1 }`.
 * A plain object whose only key is a tag goes as `{ "$escape": object }`, so data never reads as a tag.
 * Anything else encodes as `JSON.stringify` would: `toJSON` first, own enumerable keys, `undefined` properties dropped.
 */

const TAGS = new Set(["$date", "$bigint", "$number", "$map", "$set", "$binary", "$undefined", "$escape"]);

export function encode(value: unknown): unknown {
  return into(value, new Set());
}

function into(value: unknown, seen: Set<object>): unknown {
  switch (typeof value) {
    case "bigint":
      return { $bigint: value.toString() };
    case "number":
      return Number.isFinite(value) ? value : { $number: String(value) };
    case "object":
      break;
    default:
      return value;
  }

  if (value === null) return null;
  if (value instanceof Date) return { $date: Number.isNaN(value.getTime()) ? null : value.toISOString() };
  if (value instanceof Uint8Array) return { $binary: toBase64(value) };
  if (value instanceof ArrayBuffer) return { $binary: toBase64(new Uint8Array(value)) };

  if (seen.has(value)) throw new TypeError("Cannot send a circular structure.");
  seen.add(value);

  try {
    if (Array.isArray(value)) return value.map(item => (item === undefined ? { $undefined: 1 } : unlisted(item) ? null : into(item, seen)));
    if (value instanceof Map) return { $map: [...value].map(([key, item]) => [into(key, seen), into(item, seen)]) };
    if (value instanceof Set) return { $set: [...value].map(item => into(item, seen)) };

    const json = (value as { toJSON?: () => unknown }).toJSON;

    if (typeof json == "function") return into(json.call(value), seen);

    const out: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) if (item !== undefined && !unlisted(item)) out[key] = into(item, seen);

    const keys = Object.keys(out);

    return keys.length === 1 && TAGS.has(keys[0]) ? { $escape: out } : out;
  } finally {
    seen.delete(value);
  }
}

/** What JSON leaves out of an object and nulls in an array. */
const unlisted = (value: unknown) => typeof value == "function" || typeof value == "symbol";

export function decode(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(decode);
  if (value === null || typeof value != "object") return value;

  const keys = Object.keys(value);
  const record = value as Record<string, unknown>;

  if (keys.length === 1 && TAGS.has(keys[0])) {
    const [tag] = keys;
    const inner = record[tag];

    switch (tag) {
      case "$date":
        return new Date(inner === null ? NaN : (inner as string));
      case "$bigint":
        return BigInt(inner as string);
      case "$number":
        return Number(inner);
      case "$map":
        return new Map((inner as [unknown, unknown][]).map(([key, item]) => [decode(key), decode(item)]));
      case "$set":
        return new Set((inner as unknown[]).map(decode));
      case "$binary":
        return fromBase64(inner as string);
      case "$undefined":
        return undefined;
      default:
        return entries(inner as Record<string, unknown>);
    }
  }

  return entries(record);
}

function entries(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const key of Object.keys(record)) out[key] = decode(record[key]);

  return out;
}

export const stringify = (value: unknown): string => JSON.stringify(encode(value));

export const parse = (text: string): unknown => decode(JSON.parse(text));

function toBase64(bytes: Uint8Array): string {
  let text = "";

  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));

  return btoa(text);
}

function fromBase64(text: string): Uint8Array {
  const raw = atob(text);
  const bytes = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

  return bytes;
}
