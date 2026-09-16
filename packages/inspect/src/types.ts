import { State } from '@expressive/mvc';

export interface TypeInfo {
  /** Opaque, stable for the life of the process. */
  typeId: string;
  /** Resolved display name - see `label`. */
  type: string;
  /** Construction stack captured at first sight, for a source-map resolver. */
  site: string;
}

const info = new Map<typeof State, TypeInfo>();
const labels = new Map<typeof State, string>();
const names = new Map<string, string>();
let count = 0;

function register(Type: typeof State): TypeInfo {
  let row = info.get(Type);
  if (!row) {
    const site = String(new Error().stack).split('\n').slice(1, 16).join('\n');
    info.set(Type, (row = { typeId: `T${++count}`, type: '', site }));
  }
  return row;
}

export function seen(Type: typeof State): TypeInfo {
  const row = register(Type);
  row.type = labelOf(Type);
  return { ...row };
}

export function labelOf(Type: typeof State): string {
  const row = register(Type);
  const explicit = labels.get(Type) ?? (Type as { displayName?: string }).displayName;
  if (explicit) return explicit;
  const named = names.get(row.typeId) ?? names.get(row.site);
  if (named) return named;
  return Type.name.length > 2 ? Type.name : row.typeId;
}

export function label(Type: typeof State, name: string): void {
  labels.set(Type, name);
}

/** Supply resolved names keyed by `typeId` or `site`, e.g. from a source-map pass. */
export function resolve(table: Record<string, string>): void {
  for (const [key, name] of Object.entries(table)) names.set(key, name);
}

export function forget(): void {
  info.clear();
  labels.clear();
  names.clear();
  count = 0;
}
