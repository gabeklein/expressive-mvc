import { State, unbind } from '@expressive/mvc';
import { event, touch } from '@expressive/mvc/observable';

interface Node {
  id: string;
  key: string;
  args: unknown[];
  after: string[];
}

interface Token extends Node {
  then(onfulfilled?: (value: Handle) => unknown, onrejected?: (reason: unknown) => unknown): Promise<unknown>;
}

interface Handle {
  [UNDO]: Token;
}

interface Frame extends Node {
  tokens: Token[];
  awaited: Set<string>;
  wrote: Set<string>;
  prior: Record<string, unknown>;
  violation?: string;
  late?: boolean;
  armed?: number;
  settled?: boolean;
  unwind?: boolean;
}

interface Internal<T extends State = State> {
  self: T;
  status: Runner.Status;
  step: string;
  error: unknown;
  entries: Runner.Entry[];
  pending: Node[];
  done: Set<string>;
  running?: Frame;
  undo: Map<string, Function | Node>;
  counts: Map<string, number>;
  result: Promise<unknown>;
  awaited: boolean;
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

const INTERNAL = Symbol('run');
const UNDO = Symbol('undo');
const FRAME = new WeakMap<object, Frame>();
const STEP = new WeakMap<Function, Function>();
const SLACK = 8;

declare namespace Runner {
  type Status = 'running' | 'done' | 'failed';

  type Result<T> = T extends { done(...args: infer A): infer R }
    ? R extends void ? A[0] : R
    : State.Values<T>;

  interface Entry {
    id: string;
    key: string;
    args: unknown[];
    prior: { [key: string]: unknown };
    patch: { [key: string]: unknown };
    next: Node[];
    undo?: 'closure' | Node;
    undone?: true | 'failed';
  }

  interface Record {
    status: Status;
    step: string;
    error: unknown;
    entries: Entry[];
  }
}

interface Runner<T extends State = State> {
  (onfulfilled?: ((value: Runner.Result<T>) => unknown) | null, onrejected?: ((reason: unknown) => unknown) | null): Promise<unknown>;

  then<R1 = Runner.Result<T>, R2 = never>(
    onfulfilled?: ((value: Runner.Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2>;

  /** The instance this controller runs. */
  readonly on: T;
  readonly status: Runner.Status;
  /** Key of the step in flight, or empty. */
  readonly step: string;
  readonly error: unknown;
  /** The journal - one entry per settled step. */
  readonly entries: readonly Runner.Entry[];

  get(): Runner.Record;
  /** Ends the run once every other scheduled step has settled - with this value, else the class's `done`, else a dump of its public values. */
  done(value?: unknown): void;
}

/**
 * Make this State runnable: its methods become steps, each scheduling the next, and the
 * returned Runner is the controller - status, journal, result. `_`-prefixed methods are helpers.
 */
function run<T extends State>(self: T): Runner<T> {
  let resolve!: Internal['resolve'];
  let reject!: Internal['reject'];

  const result = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  result.catch(() => {});

  const internal: Internal<T> = {
    self,
    status: 'running',
    step: '',
    error: undefined,
    entries: [],
    pending: [],
    done: new Set(),
    undo: new Map(),
    counts: new Map(),
    result,
    awaited: false,
    resolve,
    reject
  };

  const runner = function (onfulfilled?: Function | null, onrejected?: Function | null) {
    internal.awaited = true;
    return result.then(onfulfilled as any, onrejected as any);
  } as Runner<T>;

  Object.defineProperties(runner, {
    [INTERNAL]: { value: internal },
    then: { value: runner },
    on: { value: self },
    status: { get(this: object) { return touch(this, 'status', internal.status); } },
    step: { get(this: object) { return touch(this, 'step', internal.step); } },
    error: { get(this: object) { return touch(this, 'error', internal.error); } },
    entries: { get(this: object) { return touch(this, 'entries', internal.entries); } },
    get: {
      value() {
        const { status, step, error, entries } = internal;

        return { status, step, error, entries };
      }
    },
    done: {
      value(value?: unknown) {
        schedule(runner, 'done', value === undefined ? [] : [value], internal.running);
      }
    }
  });

  event(runner);

  for (let proto = Object.getPrototypeOf(self); proto !== State.prototype; proto = Object.getPrototypeOf(proto))
    for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
      if (key == 'constructor' || key[0] == '_' || !desc.get || Object.hasOwn(self, key)) continue;

      const wrapper = function (this: object, ...args: unknown[]) {
        return schedule(runner, key, key == 'new' ? [] : args, FRAME.get(this));
      };

      STEP.set(wrapper, unbind(desc.get));
      Object.defineProperty(self, key, { value: wrapper, writable: true, configurable: true });
    }

  return runner;
}

function internals(runner: Runner) {
  return (runner as unknown as { [INTERNAL]: Internal })[INTERNAL];
}

function update(runner: Runner, key: keyof Runner.Record, value: unknown) {
  internals(runner)[key] = value as never;
  event(runner, key);
}

function schedule(runner: Runner, key: string, args: unknown[], frame?: Frame) {
  const internal = internals(runner);

  if (internal.status != 'running') throw new Error(`${internal.self} is ${internal.status}; ${key} cannot run.`);

  if (!frame) {
    if (internal.running) throw new Error(`${internal.running.key} is running; ${key} cannot be called from outside.`);

    invoke(runner, node(internal, key, args, [])).catch((error) => fail(runner, error));
    return;
  }

  const token = node(internal, key, args, [...frame.awaited]) as Token;
  const handle = { [UNDO]: token };

  token.then = (onfulfilled, onrejected) => {
    frame.awaited.add(token.id);

    const out = Promise.resolve(handle).then(onfulfilled, onrejected);

    arm(frame);
    return out;
  };

  frame.tokens.push(token);
  arm(frame);

  return token;
}

function node(internal: Internal, key: string, args: unknown[], after: string[]): Node {
  const count = (internal.counts.get(key) || 0) + 1;

  internal.counts.set(key, count);

  return { id: `${key}#${count}`, key, args, after };
}

function arm(frame: Frame) {
  const armed = (frame.armed = (frame.armed || 0) + 1);
  let hops = SLACK;

  const tick = () => {
    if (frame.settled || frame.armed != armed) return;
    if (--hops) queueMicrotask(tick);
    else frame.late = true;
  };

  queueMicrotask(tick);
}

function invoke(runner: Runner, node: Node, undo?: Function | true) {
  const internal = internals(runner);
  const { self } = internal;
  const fn = typeof undo == 'function' ? undo : STEP.get((self as any)[node.key]) || (() => {});
  const frame: Frame = { ...node, tokens: [], awaited: new Set(), wrote: new Set(), prior: {}, unwind: !!undo };
  const proxy = new Proxy(self, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);

      if (typeof value != 'function') return value;
      if (STEP.has(value)) return value.bind(proxy);
      if ((prop as string)[0] == '_') return unbind(value).bind(proxy);

      return Object.hasOwn(target, prop) ? value : value.bind(target);
    },
    set(target, prop, value) {
      const key = String(prop);

      if (!frame.wrote.has(key)) {
        frame.prior[key] = Reflect.get(target, prop, target);
        frame.wrote.add(key);
      }

      if (frame.tokens.length) frame.violation ||= key;

      return Reflect.set(target, prop, value, target);
    }
  });

  FRAME.set(proxy, frame);
  internal.running = frame;
  update(runner, 'step', node.key);

  const restore = (error: unknown) => {
    Object.assign(self, frame.prior);
    throw error;
  };

  let out: unknown;

  try {
    out = fn.apply(proxy, node.args);
  } catch (error) {
    return Promise.reject(error).catch(restore);
  }

  return Promise.resolve(out).then((out) => settle(runner, frame, out)).catch(restore);
}

function settle(runner: Runner, frame: Frame, out: unknown) {
  const internal = internals(runner);
  const { self } = internal;
  const { id, key, args, tokens, wrote, prior, violation, late } = frame;

  frame.settled = true;
  internal.running = undefined;
  update(runner, 'step', '');

  if (frame.unwind) return;

  if (violation) throw new Error(`${key} wrote ${violation} after scheduling ${tokens[0].key}.`);
  if (late) throw new Error(`${key} kept working after scheduling ${tokens[0].key}.`);

  let undo: Function | Node | undefined;

  if (key == 'done') {
    if (tokens.length) throw new Error(`done cannot schedule ${tokens[0].key}.`);
    if (out === undefined) out = args.length ? args[0] : dump(self, runner);
  }
  else if (typeof out == 'function') undo = out;
  else if (out && typeof out == 'object' && UNDO in out) {
    const token = (out as Handle)[UNDO];

    tokens.splice(tokens.indexOf(token), 1);
    undo = { id: token.id, key: token.key, args: token.args, after: [] };
  }
  else if (out !== undefined) throw new Error(`${key} returned a value; a step returns nothing, or its undo.`);

  const values = self.get() as Record<string, unknown>;
  const patch = Object.fromEntries([...wrote].map((key) => [key, values[key]]));
  const next = tokens.map(({ id, key, args, after }) => ({ id, key, args, after }));
  const entry: Runner.Entry = { id, key, args, prior, patch, next };

  if (undo) {
    entry.undo = typeof undo == 'function' ? 'closure' : undo;
    internal.undo.set(id, undo);
  }

  internal.done.add(id);
  internal.pending.push(...next);
  update(runner, 'entries', [...internal.entries, entry]);

  if (key == 'done') return finish(runner, out);

  drain(runner);
}

function drain(runner: Runner) {
  const internal = internals(runner);
  const { pending, done } = internal;

  const ready = pending.find((node) =>
    node.key == 'done' ? pending.length == 1 : node.after.every((id) => done.has(id))
  );

  if (!ready) {
    const stuck = pending.find((node) => node.key != 'done');

    if (stuck) throw new Error(`${stuck.key} waits on ${stuck.after.find((id) => !done.has(id))}, which was returned as an undo.`);
    if (pending.length) throw new Error('done was scheduled twice.');

    finish(runner, dump(internal.self, runner));
    return;
  }

  pending.splice(pending.indexOf(ready), 1);
  invoke(runner, ready).catch((error) => fail(runner, error));
}

function finish(runner: Runner, value: unknown) {
  update(runner, 'status', 'done');
  internals(runner).resolve(value);
}

function dump(self: State, runner: Runner) {
  const values = self.get() as Record<string, unknown>;

  return Object.fromEntries(Object.entries(values).filter(([key]) => (self as any)[key] !== runner));
}

async function fail(runner: Runner, error: unknown) {
  const internal = internals(runner);
  const { self, entries, undo } = internal;

  internal.running = undefined;
  internal.pending.length = 0;
  update(runner, 'status', 'failed');
  update(runner, 'error', error);
  update(runner, 'step', '');

  for (const entry of [...entries].reverse()) {
    const how = undo.get(entry.id);

    try {
      if (typeof how == 'function') await invoke(runner, { id: `${entry.id}:undo`, key: entry.key, args: [], after: [] }, how);
      else if (how) await invoke(runner, { ...how, id: `${entry.id}:undo` }, true);

      Object.assign(self, entry.prior);

      entry.undone = true;
    } catch (cause) {
      entry.undone = 'failed';
      update(runner, 'error', cause);
      update(runner, 'entries', [...entries]);
      break;
    }

    update(runner, 'entries', [...entries]);
  }

  internal.reject(internal.error);

  queueMicrotask(() => queueMicrotask(() => {
    if (!internal.awaited) throw internal.error;
  }));
}

export { run, Runner };
