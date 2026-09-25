import { State } from '@expressive/mvc';

import { parsePath, serialize } from './serialize';
import { settle } from './settle';
import { labelOf, seen } from './types';

export type Level = 'off' | 'keys' | 'values';

export interface Options {
  level?: Level;
  /** Labels to record. */
  types?: string[];
  /** `Type.key` addresses to record - label, `typeId`, or instance id on the left, property on the right. */
  paths?: string[];
  /** Property names to record on any type. */
  keys?: string[];
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
  /** Frame whose flush scheduled the work that opened this one. */
  cause?: number;
  events: Event[];
}

export interface Query {
  since?: number;
  type?: string;
  id?: string;
  key?: string;
  cause?: number;
}

const FRAME_CAP = 500;

const frames: Frame[] = [];
const config: Required<Options> = { level: 'off', types: [], paths: [], keys: [], calls: false };
let seq = 0;
let open: Frame | undefined;
let cause: number | undefined;

export const journal = {
  record(options: Options = {}): Required<Options> {
    Object.assign(config, options);
    if (!options.level && options.calls && config.level === 'off') config.level = 'keys';
    return { ...config, types: [...config.types], paths: [...config.paths], keys: [...config.keys] };
  },

  frames(query: Query = {}): Frame[] {
    const out: Frame[] = [];
    for (const frame of frames) {
      if (query.since !== undefined && frame.seq <= query.since) continue;
      if (query.cause !== undefined && frame.cause !== query.cause) continue;
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

  /** Frames reachable from `seq` through `cause` links, in order. */
  downstream(from: number): Frame[] {
    const roots = new Set([from]);
    return frames.filter((frame) => {
      if (frame.cause === undefined || !roots.has(frame.cause)) return false;
      roots.add(frame.seq);
      return true;
    });
  },

  /** Current sequence - pass as `since` to read only what follows. */
  seq(): number {
    return seq;
  },

  /** One event per line, for bulk export to a sidecar. */
  export(query: Query = {}): string {
    return journal
      .frames(query)
      .flatMap((frame) =>
        frame.events.map((event) =>
          JSON.stringify({ seq: frame.seq, at: frame.at, cause: frame.cause, ...event })
        )
      )
      .join('\n');
  },

  clear(): void {
    frames.length = 0;
    open = undefined;
    cause = undefined;
    seq = 0;
  },

  reset(): void {
    journal.clear();
    Object.assign(config, { level: 'off', types: [], paths: [], keys: [], calls: false });
  }
};

function matches(event: Event, query: Query) {
  return (
    (!query.type || event.type === query.type) &&
    (!query.id || event.id === query.id) &&
    (!query.key || event.key === query.key)
  );
}

/** Filters OR together; none set records everything. Without a key only type-level filters apply. */
export function wants(state: State, key?: string): boolean {
  if (config.level === 'off') return false;

  const { types, paths, keys } = config;
  if (!types.length && !paths.length && !keys.length) return true;

  const Type = state.constructor as typeof State;
  const label = labelOf(Type);
  if (types.includes(label)) return true;
  if (key !== undefined && keys.includes(key)) return true;

  const targets = [label, seen(Type).typeId, String(state)];
  for (const address of paths) {
    const { target, path } = parsePath(address);
    if (targets.includes(target) && (key === undefined || path === key)) return true;
  }
  return false;
}

export function recordsCalls(): boolean {
  return config.calls && config.level !== 'off';
}

/** Run `work` with recording forced on; returns the frames it produced. */
export async function act(work: () => unknown): Promise<Frame[]> {
  const level = config.level;
  const start = seq;
  if (level === 'off') config.level = 'values';
  try {
    await work();
    await settle(() => seq);
  } finally {
    config.level = level;
  }
  return journal.frames({ since: start });
}

export function note(state: State, key: unknown, store: Map<string, unknown>): void {
  const name = String(key);
  if (!wants(state, name)) return;

  const event: Event = {
    id: String(state),
    type: labelOf(state.constructor as typeof State),
    key: name,
    kind: typeof key === 'string' && store.has(key) ? 'update' : 'event'
  };

  if (config.level === 'values' && event.kind === 'update')
    event.value = serialize(store.get(name), 1);

  push(event);
}

export function noteCall(state: State, key: string, args: unknown[]): void {
  if (!recordsCalls() || !wants(state, key)) return;

  const event: Event = { id: String(state), type: labelOf(state.constructor as typeof State), key, kind: 'call' };
  if (config.level === 'values') event.args = args.map((arg) => serialize(arg, 1));
  push(event);
}

export function noteDestroy(state: State): void {
  if (!wants(state)) return;
  push({ id: String(state), type: labelOf(state.constructor as typeof State), key: '', kind: 'destroy' });
}

function push(event: Event) {
  if (!open) {
    const frame: Frame = { seq: ++seq, at: Date.now(), events: [] };
    if (cause !== undefined) frame.cause = cause;
    open = frame;
    frames.push(frame);
    if (frames.length > FRAME_CAP) frames.splice(0, frames.length - FRAME_CAP);
    queueMicrotask(() => {
      open = undefined;
      cause = frame.seq;
      queueMicrotask(() => {
        if (seq === frame.seq) cause = undefined;
      });
    });
  }
  open.events.push(event);
}
