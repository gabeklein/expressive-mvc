import { State } from '@expressive/mvc';

import { entries, serialize } from './serialize';
import { labelOf } from './types';

export type Level = 'off' | 'keys' | 'values';

export interface Options {
  level?: Level;
  /** Labels to record; default all. */
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
const config: Required<Options> = { level: 'off', types: [], calls: false };
let seq = 0;
let open: Frame | undefined;
let cause: number | undefined;

export const journal = {
  record(options: Options = {}): Required<Options> {
    Object.assign(config, options);
    if (!options.level && options.calls && config.level === 'off') config.level = 'keys';
    return { ...config, types: [...config.types] };
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

/** Run `work` with recording forced on; returns the frames it produced. */
export async function act(work: () => unknown): Promise<Frame[]> {
  const level = config.level;
  const start = seq;
  if (level === 'off') config.level = 'values';
  try {
    await work();
    await new Promise((resolve) => setTimeout(resolve, 0));
  } finally {
    config.level = level;
  }
  return journal.frames({ since: start });
}

export function note(state: State, key: unknown, store = entries(state)): void {
  const type = labelOf(state.constructor as typeof State);
  if (!wants(type)) return;

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
  const type = labelOf(state.constructor as typeof State);
  if (!recordsCalls() || !wants(type)) return;

  const event: Event = { id: String(state), type, key, kind: 'call' };
  if (config.level === 'values') event.args = args.map((arg) => serialize(arg, 1));
  push(event);
}

export function noteDestroy(state: State): void {
  const type = labelOf(state.constructor as typeof State);
  if (!wants(type)) return;
  push({ id: String(state), type, key: '', kind: 'destroy' });
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
