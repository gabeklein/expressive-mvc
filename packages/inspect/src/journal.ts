import { State } from '@expressive/mvc';

import { entries, serialize } from './serialize';

export type Level = 'off' | 'keys' | 'values';

export interface Options {
  level?: Level;
  /** Class names to record; default all. */
  types?: string[];
  /** Also record method calls (wraps instance methods except `render`). */
  calls?: boolean;
}

export interface Event {
  id: string;
  type: string;
  key: string;
  kind: 'update' | 'event' | 'call' | 'destroy';
  value?: unknown;
  args?: unknown[];
}

export interface Frame {
  seq: number;
  at: number;
  events: Event[];
}

export interface Query {
  since?: number;
  type?: string;
  id?: string;
  key?: string;
}

const FRAME_CAP = 500;

const frames: Frame[] = [];
const config: Required<Options> = { level: 'off', types: [], calls: false };
let seq = 0;
let open: Frame | undefined;

export const journal = {
  record(options: Options = {}): Required<Options> {
    Object.assign(config, options);
    if (!options.level && options.calls) config.level = config.level === 'off' ? 'keys' : config.level;
    return { ...config, types: [...config.types] };
  },

  frames(query: Query = {}): Frame[] {
    const out: Frame[] = [];
    for (const frame of frames) {
      if (query.since !== undefined && frame.seq <= query.since) continue;
      const events = frame.events.filter((e) => matches(e, query));
      if (events.length) out.push({ ...frame, events });
    }
    return out;
  },

  history(query: Query): Array<{ seq: number; at: number; event: Event }> {
    const out = [];
    for (const frame of journal.frames(query))
      for (const event of frame.events) out.push({ seq: frame.seq, at: frame.at, event });
    return out;
  },

  clear(): void {
    frames.length = 0;
    open = undefined;
    seq = 0;
  },

  reset(): void {
    journal.clear();
    Object.assign(config, { level: 'off', types: [], calls: false });
  }
};

function matches(event: Event, query: Query) {
  return (
    (!query.type || event.type === query.type) &&
    (!query.id || event.id === query.id) &&
    (!query.key || event.key === query.key)
  );
}

export function wants(type: string): boolean {
  return config.level !== 'off' && (!config.types.length || config.types.includes(type));
}

export function recordsCalls(): boolean {
  return config.calls && config.level !== 'off';
}

export function note(state: State, key: unknown): void {
  const type = state.constructor.name;
  if (!wants(type)) return;

  const store = entries(state);
  const name = String(key);
  const event: Event = {
    id: String(state),
    type,
    key: name,
    kind: typeof key === 'string' && store.has(key) ? 'update' : 'event'
  };

  if (config.level === 'values' && event.kind === 'update')
    event.value = serialize(store.get(name), 1);

  push(event);
}

export function noteCall(state: State, key: string, args: unknown[]): void {
  const type = state.constructor.name;
  if (!recordsCalls() || !wants(type)) return;

  const event: Event = { id: String(state), type, key, kind: 'call' };
  if (config.level === 'values') event.args = args.map((arg) => serialize(arg, 1));
  push(event);
}

export function noteDestroy(state: State): void {
  const type = state.constructor.name;
  if (!wants(type)) return;
  push({ id: String(state), type, key: '', kind: 'destroy' });
}

function push(event: Event) {
  if (!open) {
    open = { seq: ++seq, at: Date.now(), events: [] };
    frames.push(open);
    if (frames.length > FRAME_CAP) frames.splice(0, frames.length - FRAME_CAP);
    queueMicrotask(() => {
      open = undefined;
    });
  }
  open.events.push(event);
}
