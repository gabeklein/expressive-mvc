import { has, map, State, unbind } from '@expressive/mvc';
import { event, listener, touch } from '@expressive/mvc/observable';

type Collection = has.List<unknown> | has.Pool<unknown> | map.Managed<unknown, unknown>;

interface Run {
  internal: Internal;
  args: unknown[];
  promise: Promise<unknown>;
  resolve(value: unknown): void;
  reject(error: unknown): void;
  awaited?: boolean;
  counts: Map<string, number>;
  flight: Set<Frame>;
  parked: Map<Runner.Wait, (answer?: Answer) => void>;
  undo: Map<string, Function | Runner.Node>;
  end?: Runner.Node;
  halted?: 'failed' | 'stopped';
  ending?: boolean;
  error?: unknown;
  stopped?: Error;
  warned?: boolean;
  drained: (() => void)[];
  held: Map<Collection, Held>;
}

interface Held {
  key: string;
  value: Collection;
  raw: unknown[] | Map<unknown, unknown>;
  prior: unknown;
  readers: Set<Frame>;
  release(): void;
}

interface Answer {
  frame: Promise<Frame | undefined>;
  done(): void;
}

interface Frame extends Runner.Node {
  run: Run;
  proxy: State;
  items: Runner.Node[];
  wrote: Set<string>;
  prior: Record<string, unknown>;
  held: Map<string, Held>;
  changed: Set<string>;
  lost: Set<string>;
  wake?: string;
  undo?: boolean;
  retry?: Runner.Retry;
  violation?: string;
  late?: boolean;
  armed?: number;
  settled?: boolean;
  result?: unknown;
  view?: Runner.Controller;
}

interface Internal extends Runner.Snapshot {
  self: State;
  runner: Runner.Controller & Runner.Thenable;
  current?: Run;
  last?: Run;
  queued: Run[];
  steps: Map<string, Function>;
  present: Set<string>;
}

const FRAME = new WeakMap<object, Frame>();
const STEP = new WeakMap<Function, Function>();
const TOKEN = new WeakMap<object, Frame>();
const HELD = new WeakMap<Runner.Entry, Map<string, Held>>();
const REF = new WeakMap<Function, { internal: Internal; key: string }>();
const HOOK = /^(before|after)([A-Z]|$)/;
const KEYS = ['status', 'active', 'record', 'queue', 'waiting', 'runs', 'error'] as const;
const SLACK = 8;

let quiet = false;

declare namespace Runner {
  type Status = 'idle' | 'running' | 'waiting' | 'stopped' | 'failed';

  type Result<T> = (T & { end: unknown })['end'] extends (...args: infer A) => infer R
    ? Awaited<R> extends void ? A[0] : Awaited<R>
    : State.Values<T>;

  /** A planned item: a step, a parallel group (`group`), or a wait (`answers`). */
  interface Node {
    id: string;
    key: string;
    args: unknown[];
    group?: Node[];
    /** Keys of the steps which may answer this wait. */
    answers?: string[];
  }

  /** What a step call inside a step returns - inert, not awaitable. */
  type Token = Readonly<Node>;

  interface Entry {
    id: string;
    key: string;
    args: unknown[];
    prior: { [key: string]: unknown };
    patch: { [key: string]: unknown };
    next: Node[];
    undo?: 'closure' | Node;
    undone?: true | 'failed';
    /** Id of the wait this step answered. */
    wake?: string;
    /** Which try committed, or failed, when the step retries. */
    attempt?: number;
    /** What a failed attempt threw. */
    error?: unknown;
    /** Collections changed in a way no restore can undo - the unwind stops here. */
    irreversible?: string[];
    /** The unwind stopped at this entry; it and every entry before it stay applied. */
    halted?: true;
  }

  interface Wait {
    id: string;
    /** Key of the step which opened the wait. */
    step: string;
    /** Arguments of the step which opened the wait. */
    args: unknown[];
    /** Keys of the steps which may answer it. */
    answers: string[];
  }

  interface Retry {
    /** Tries in total, the first included. */
    attempts: number;
    /** Milliseconds to wait before the next try, given the one that failed. */
    backoff?(attempt: number): number;
  }

  interface Stop {
    /** Unwind the current run as a failure would. */
    undo?: boolean;
  }

  interface Snapshot {
    status: Status;
    active: string | undefined;
    record: Entry[];
    queue: unknown[][];
    waiting: Wait[];
    runs: number;
    error: unknown;
  }

  interface Controller<T extends State = State> {
    /**
     * Inside a step: run these tokens as one parallel group at this point in the plan.
     * The next step in sequence runs once every member, and all it schedules, is done.
     */
    <This>(this: This, steps: Iterable<unknown>): Runner.Token;

    /**
     * Inside a step: call `each` per item - a function issuing a step, or a step itself -
     * and run the tokens as one parallel group.
     */
    <I, This>(this: This, items: Iterable<I>, each: (item: I, index: number) => unknown): Runner.Token;

    /**
     * Inside a step: park this point in the plan until an outside call to one of these steps
     * answers it. The next step in sequence runs once the answer, and all it schedules, is done.
     */
    <This>(this: This, ...steps: ((...args: any[]) => unknown)[]): Runner.Token;

    /** The instance this controller runs. */
    readonly on: T;
    readonly status: Runner.Status;
    /** Key of a step in flight - the latest invoked, with a group in flight. */
    readonly active: string | undefined;
    /** Journal of the current or last run - one entry per settled step. */
    readonly record: readonly Runner.Entry[];
    /** Arguments of each `next()` waiting for the active run to finish. */
    readonly queue: readonly unknown[][];
    /** Open waits, oldest first. */
    readonly waiting: readonly Runner.Wait[];
    /** Runs finished - ended, failed or stopped. */
    readonly runs: number;
    readonly error: unknown;

    /** A plain snapshot of status, active, record, queue, waiting, runs and error. */
    get(): Runner.Snapshot;
    /**
     * Inside a step: end the run once everything else pending has settled. From outside: discard
     * pending steps and end once those in flight settle. The result is the class's `end` given this
     * value, else the value, else a dump of its public values.
     */
    end(value?: unknown): void;
    /** Cancel: discard pending steps and queued runs; in-flight steps settle and commit. */
    stop(options?: Runner.Stop): void;
    /** At the top of a step: try it again on throw. */
    retry(config: Runner.Retry): void;

    [Symbol.iterator](): Iterator<Runner.Entry>;
  }

  interface Thenable<T extends State = State> {
    /** Idle, runs `next()` - rejecting if it takes arguments; then settles once the active run and every queued one have, with the last one's result. */
    <R1 = Runner.Result<T>, R2 = never>(
      onfulfilled?: ((value: Runner.Result<T>) => R1 | PromiseLike<R1>) | null,
      onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
    ): Promise<R1 | R2>;

    then: Runner<T>;
  }
}

/**
 * The controller, and a thenable - so the instance with it as `then`. Awaiting it joins the
 * active run; idle, it runs `next()`, or rejects if `next` takes arguments.
 */
type Runner<T extends State = State> = Runner.Controller<T> & Runner.Thenable<T>;

/**
 * Make this State runnable: its methods become steps, each scheduling the next, and the
 * returned Runner is the controller - status, journal, result. `next()` starts a run.
 * `_`-prefixed methods are helpers; `before`/`after`-prefixed ones and `back` are hooks.
 */
function run<T extends State>(self: T): Runner<T> {
  const internal = {
    self,
    status: 'idle',
    active: undefined,
    record: [],
    queue: [],
    waiting: [],
    runs: 0,
    error: undefined,
    queued: [],
    steps: new Map(),
    present: new Set()
  } as unknown as Internal;

  const runner = function (onfulfilled?: unknown, onrejected?: unknown) {
    if (onfulfilled && typeof onfulfilled == 'object') throw new Error('then(steps) must be called inside a step.');

    return settled(internal).then(onfulfilled as any, onrejected as any);
  } as Runner<T>;

  internal.runner = runner as never;

  for (const key of KEYS)
    Object.defineProperty(runner, key, {
      enumerable: true,
      get(this: object) {
        return touch(this, key, internal[key]);
      }
    });

  Object.defineProperties(runner, {
    then: { value: runner },
    on: { value: self },
    get: { value: () => snapshot(internal) },
    end: { value: (value?: unknown) => conclude(internal, value) },
    stop: { value: (options?: Runner.Stop) => stop(internal, options) },
    retry: { value: () => outside('retry') },
    [Symbol.iterator]: {
      value(this: Runner.Controller) {
        return this.record[Symbol.iterator]();
      }
    }
  });

  event(runner);

  const hooks: string[] = [];

  for (let proto = Object.getPrototypeOf(self); proto !== State.prototype; proto = Object.getPrototypeOf(proto))
    for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
      let method = desc.get && unbind(desc.get) !== desc.get;
      let skip = !method || key == 'new' || key == 'back' || key[0] == '_' || Object.hasOwn(self, key);

      if (skip) continue;

      if (HOOK.test(key)) {
        hooks.push(key);
        continue;
      }

      const step = function (this: object, ...args: unknown[]) {
        return call(internal, key, args, FRAME.get(this));
      };

      internal.steps.set(key, step);
      STEP.set(step, unbind(desc.get!));
      REF.set(step, { internal, key });
      Object.defineProperty(
        self,
        key,
        key == 'next'
          ? { value: step, writable: true, configurable: true }
          : {
              configurable: true,
              get(this: object) {
                touch(this, key);
                return internal.present.has(key) ? step : undefined;
              }
            }
      );
    }

  for (const hook of hooks) {
    const target = hook.replace(HOOK, (_, __, first: string) => first.toLowerCase());

    if (target && !internal.steps.has(target)) throw new Error(`${hook} has no step ${target}.`);
  }

  self.get(null, () => stop(internal));

  return runner;
}

/**
 * A runnable State: its methods are steps, `next()` starts a run and `await job` joins it,
 * resolving with the result of `end`. The members below are the contract - each optional.
 */
class Job extends State {
  /** The controller - status, journal, queue, waits; awaiting the instance awaits it. */
  readonly then = run(this);

  /** The entry: starts a run, or queues one while a run is active. Settles with its run. */
  next?(...args: any[]): unknown;

  /** Runs last in a run. Its return, else its argument, else a dump of public values, is the result. */
  protected end?(value?: any): unknown;

  /** Before each step, once per step. `skip` is true when the step is replayed. */
  protected before?(step: string, args: unknown[], skip: boolean): void;

  /** After each step commits, once per step. `skip` is true when the step is replayed. */
  protected after?(step: string, entry: Runner.Entry, skip: boolean): void;

  /** Once an unwind completes, halted or not, before the run rejects with `error`. A throw replaces it. */
  protected back?(error: unknown): void;
}

function outside(key: string): never {
  throw new Error(`${key} must be called inside a step.`);
}

function snapshot(internal: Internal): Runner.Snapshot {
  const { status, active, record, queue, waiting, runs, error } = internal;

  return { status, active, record, queue, waiting, runs, error };
}

function update<K extends keyof Runner.Snapshot>(internal: Internal, key: K, value: Runner.Snapshot[K]) {
  (internal as Runner.Snapshot)[key] = value;
  event(internal.runner, key);
}

function call(internal: Internal, key: string, args: unknown[], frame?: Frame) {
  if (frame) return issue(frame, key, args);
  if (key == 'next') return start(internal, args);

  const { current } = internal;
  const open = current ? [...current.parked.keys()].filter((wait) => wait.answers.includes(key)) : [];
  const wait = open.find((wait) => wait.args[0] === args[0]) || open[0];

  if (wait) return wake(current!, wait, key, args);

  throw new Error(`${key} cannot be called from outside; call next() to run.`);
}

function issue(frame: Frame, key: string, args: unknown[]) {
  const { run } = frame;
  const { internal } = run;

  if (frame.undo) throw new Error(`${internal.self} is ${internal.status}; ${key} cannot run.`);
  if (frame.settled) throw new Error(`${frame.key} has settled; ${key} cannot run.`);

  const token = node(run, key, args);

  frame.items.push(token);
  TOKEN.set(token, frame);
  arm(frame);

  return token;
}

function node(run: Run, key: string, args: unknown[]): Runner.Node {
  const count = (run.counts.get(key) || 0) + 1;

  run.counts.set(key, count);

  return { id: `${key}#${count}`, key, args };
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

function start(internal: Internal, args: unknown[]) {
  let resolve!: Run['resolve'];
  let reject!: Run['reject'];

  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  const run: Run = {
    internal,
    args,
    promise,
    resolve,
    reject,
    counts: new Map(),
    flight: new Set(),
    parked: new Map(),
    undo: new Map(),
    drained: [],
    held: new Map()
  };

  promise.catch(() => {});

  if (internal.current) {
    internal.queued.push(run);
    update(internal, 'queue', internal.queued.map((run) => run.args));
  }
  else begin(run);

  return handle(run, run.promise.then());
}

function handle<T>(run: Run, out: Promise<T>) {
  out.catch(() => {});

  return Object.defineProperty(out, 'then', {
    value(this: Promise<unknown>, ...args: Parameters<Promise<unknown>['then']>) {
      run.awaited = true;
      return Promise.prototype.then.apply(this, args);
    }
  });
}

function begin(run: Run) {
  const { internal } = run;

  internal.current = run;
  update(internal, 'record', []);
  update(internal, 'error', undefined);
  update(internal, 'status', 'running');

  exec(run, node(run, 'next', run.args)).then(() => {
    if (!run.halted && !run.ending) end(run);
  });
}

async function exec(run: Run, item: Runner.Node): Promise<void> {
  if (run.halted || run.ending) return;

  if (item.group) {
    await Promise.all(item.group.map((member) => exec(run, member)));
    return;
  }

  if (item.answers) {
    const answer = await park(run, item);

    if (answer) {
      await descend(run, await answer.frame);
      answer.done();
    }
  }
  else if (item.key != 'end') await descend(run, await invoke(run, item));
}

async function descend(run: Run, frame?: Frame) {
  if (frame) for (const child of frame.items) await exec(run, child);
}

function park(run: Run, item: Runner.Node) {
  const { internal } = run;
  const { key, args } = TOKEN.get(item)!;
  const wait: Runner.Wait = { id: item.id, step: key, args, answers: item.answers! };
  let closures = [...run.undo.values()].some((undo) => typeof undo == 'function');

  if (closures && !run.warned) {
    run.warned = true;
    console.warn(`${internal.self} is waiting with undo closures held; a closure does not survive a resume.`);
  }

  return new Promise<Answer | undefined>((resolve) => {
    run.parked.set(wait, resolve);
    sync(run);
  });
}

function wake(run: Run, wait: Runner.Wait, key: string, args: unknown[]) {
  const resolve = run.parked.get(wait)!;
  let done!: () => void;
  let fail!: (error: unknown) => void;

  const answered = new Promise<void>((res, rej) => {
    done = res;
    fail = rej;
  });

  run.parked.delete(wait);
  sync(run);
  resolve({
    frame: invoke(run, node(run, key, args), wait.id),
    done: () => (run.halted ? run.promise.catch(fail) : done())
  });

  return handle(run, answered);
}

function release(run: Run) {
  for (const resolve of run.parked.values()) resolve();

  run.parked.clear();
  sync(run);
}

function sync(run: Run) {
  const { internal, parked, halted } = run;
  const { self, present } = internal;
  const waits = [...parked.keys()];
  const answers = new Set(waits.flatMap((wait) => wait.answers));

  internal.present = answers;
  update(internal, 'waiting', waits);

  for (const key of new Set([...present, ...answers])) if (present.has(key) != answers.has(key)) event(self, key);

  if (!halted) update(internal, 'status', parked.size ? 'waiting' : 'running');
}

function enter(run: Run, node: Runner.Node) {
  const { internal } = run;
  const { self, runner } = internal;

  const frame = { ...node, run, items: [], wrote: new Set(), prior: {}, held: new Map(), changed: new Set(), lost: new Set() } as unknown as Frame;

  frame.proxy = new Proxy(self, {
    get(target, prop) {
      const step = internal.steps.get(prop as string);

      if (step) return ref(step, frame.proxy);

      const value = Reflect.get(target, prop, target);

      if (value === runner) return view(frame);
      if (typeof value != 'function') {
        let fresh = !frame.undo && !frame.settled && !frame.held.has(prop as string) && collection(value);

        if (fresh) hold(frame, prop as string, value);

        return value;
      }

      return Object.hasOwn(target, prop) ? value : value.bind(target);
    },
    set(target, prop, value) {
      const key = String(prop);

      if (!frame.wrote.has(key)) {
        frame.prior[key] = Reflect.get(target, prop, target);
        frame.wrote.add(key);
      }

      if (frame.items.length) frame.violation ||= key;

      return Reflect.set(target, prop, value, target);
    }
  });

  FRAME.set(frame.proxy, frame);

  return frame;
}

function view(frame: Frame): Runner.Controller {
  if (frame.view) return frame.view;

  const { internal } = frame.run;

  const view = function (...args: unknown[]) {
    const [steps, each] = args as [Iterable<unknown>, (item: unknown, index: number) => unknown];
    const refs = args.map((arg) => REF.get(arg as Function));
    let waits = refs.length && refs.every((ref) => ref?.internal === internal);

    if (waits) return wait(frame, refs.map((ref) => ref!.key));

    let awaited = !steps || typeof steps == 'function';

    if (awaited) throw new Error('a step cannot await its own run.');

    return group(frame, Array.from(steps, each));
  } as Runner.Controller;

  Object.setPrototypeOf(view, internal.runner);
  Object.defineProperties(view, {
    then: { value: view },
    end: { value: (value?: unknown) => issue(frame, 'end', value === undefined ? [] : [value]) },
    retry: { value: (config: Runner.Retry) => void (frame.retry = config) }
  });

  return (frame.view = view);
}

function group(frame: Frame, members: unknown[]) {
  for (const member of members)
    if (!frame.items.includes(member as Runner.Node)) throw new Error(`then() takes steps called by ${frame.key}.`);

  const group = { ...node(frame.run, 'then', []), group: members as Runner.Node[] };

  frame.items = frame.items.filter((item) => !members.includes(item));
  frame.items.push(group);
  arm(frame);

  return group;
}

function wait(frame: Frame, answers: string[]) {
  for (const key of answers) if (key == 'next' || key == 'end') throw new Error(`${key} cannot answer a wait.`);

  return Object.assign(issue(frame, 'wait', []), { answers });
}

function ref(step: Function, proxy: State) {
  const bound = step.bind(proxy);

  REF.set(bound, REF.get(step)!);

  return bound;
}

function hook(self: State, key: string, ...args: unknown[]) {
  (self as any)[key]?.(...args);
}

function capital(key: string) {
  return key[0].toUpperCase() + key.slice(1);
}

async function invoke(run: Run, node: Runner.Node, wake?: string): Promise<Frame | undefined> {
  const { internal, flight } = run;
  const { self } = internal;
  const { id, key, args } = node;
  const fn = STEP.get(internal.steps.get(key)!) || (() => {});
  const frame = enter(run, node);

  frame.wake = wake;
  flight.add(frame);
  update(internal, 'active', key);

  try {
    hook(self, 'before', key, args, false);
    hook(self, `before${capital(key)}`, false, ...args);

    let out: unknown;

    for (let attempt = 1; ; attempt++)
      try {
        out = await fn.apply(frame.proxy, args);
        frame.settled = true;

        const entry = commit(frame, out, attempt);

        hook(self, `after${capital(key)}`, false, entry);
        hook(self, 'after', key, entry, false);

        return frame;
      } catch (error) {
        let irreversible = [...frame.lost];
        let retry = !frame.settled && !irreversible.length && frame.retry && attempt < frame.retry.attempts;

        if (irreversible.length) record(internal, { ...journal(frame), error, irreversible, ...frame.retry && { attempt } });
        if (!retry) throw error;

        restore(self, frame.prior, touched(frame));
        leave(frame);
        Object.assign(frame, { held: new Map(), changed: new Set() });
        record(internal, { id, key, args, prior: {}, patch: {}, next: [], attempt, error });

        const delay = frame.retry!.backoff?.(attempt);

        await new Promise((resolve) => (delay ? setTimeout(resolve, delay) : resolve(0)));

        if (run.halted) throw error;

        Object.assign(frame, { items: [], wrote: new Set(), prior: {}, violation: undefined, late: undefined });
        frame.armed = (frame.armed || 0) + 1;
      }
  } catch (error) {
    frame.settled = true;

    if (!frame.lost.size) restore(self, frame.prior, touched(frame));

    halt(run, 'failed', error);
  } finally {
    leave(frame);
    flight.delete(frame);
    update(internal, 'active', [...flight].at(-1)?.key);

    if (!flight.size) for (const resolve of run.drained.splice(0)) resolve();
  }
}

function commit(frame: Frame, out: unknown, attempt: number) {
  const { run, id, key, args, items, violation, late, wake, lost } = frame;
  const { internal } = run;

  if (violation) throw new Error(`${key} wrote ${violation} after scheduling ${items[0].key}.`);
  if (late) throw new Error(`${key} kept working after scheduling ${items[0].key}.`);

  let undo: Function | Runner.Node | undefined;
  let token = TOKEN.get(out as object) === frame && items.includes(out as Runner.Node) && !(out as Runner.Node).answers;

  if (key == 'end') {
    if (items.length) throw new Error(`end cannot schedule ${items[0].key}.`);

    frame.result = out !== undefined ? out : args.length ? args[0] : dump(internal);
  }
  else if (typeof out == 'function') undo = out;
  else if (token) {
    undo = out as Runner.Node;
    items.splice(items.indexOf(undo), 1);
  }
  else if (out !== undefined) throw new Error(`${key} returned a value; a step returns nothing, or its undo.`);

  for (const item of items)
    if (item.key == 'end' && TOKEN.has(item)) {
      if (run.end) throw new Error('end was scheduled twice.');

      run.end = item;
    }

  const entry: Runner.Entry = { ...journal(frame), next: items };

  if (wake) entry.wake = wake;
  if (attempt > 1) entry.attempt = attempt;

  if (undo) {
    entry.undo = typeof undo == 'function' ? 'closure' : undo;
    run.undo.set(id, undo);
  }
  else if (lost.size) entry.irreversible = [...lost];

  HELD.set(entry, touched(frame));
  record(internal, entry);

  return entry;
}

function journal(frame: Frame): Runner.Entry {
  const { run, id, key, args, wrote, prior, held, changed } = frame;
  const values = run.internal.self.get() as Record<string, unknown>;
  const collections = [...changed].map((key) => [key, held.get(key)!.prior]);
  const patch = Object.fromEntries([...wrote, ...changed].map((key) => [key, values[key]]));

  return { id, key, args, prior: { ...prior, ...Object.fromEntries(collections) }, patch, next: [] };
}

function collection(value: unknown): value is Collection {
  return value instanceof has.List || value instanceof has.Pool || value instanceof map.Managed;
}

function hold(frame: Frame, key: string, value: Collection) {
  const { run } = frame;
  const held = run.held.get(value) || capture(run, key, value);

  held.readers.add(frame);
  frame.held.set(key, held);
}

function capture(run: Run, key: string, value: Collection) {
  const raw = value instanceof has.List ? value.get(0, value.size) : value instanceof Map ? new Map(value) : [...value];
  const held = { key, value, raw, prior: value.get(), readers: new Set() } as Held;

  held.release = listener(value, (signal) => {
    if (quiet || typeof signal == 'boolean' || signal === null) return;

    const gone = lost(held, signal);

    for (const reader of held.readers) {
      reader.changed.add(key);
      if (gone) reader.lost.add(key);
    }
  });

  run.held.set(value, held);

  return held;
}

function lost({ value, raw }: Held, signal: unknown) {
  if (value instanceof has.Pool) return (raw as unknown[]).includes(signal) && !value.has(signal);
  if (value instanceof Map) return dead((raw as Map<unknown, unknown>).get(signal));

  return false;
}

function dead(value: unknown) {
  return value instanceof State && value.get(null);
}

function leave(frame: Frame) {
  for (const each of frame.held.values()) {
    each.readers.delete(frame);

    if (each.readers.size) continue;

    each.release();
    frame.run.held.delete(each.value);
  }
}

function touched({ held, changed }: Frame) {
  return new Map([...changed].map((key) => [key, held.get(key)!]));
}

function restore(self: State, prior: Record<string, unknown>, held: Map<string, Held>) {
  for (const key in prior) if (!held.has(key)) (self as any)[key] = prior[key];

  quiet = true;

  try {
    for (const each of held.values()) revert(each);
  } finally {
    quiet = false;
  }
}

function revert({ value, raw }: Held) {
  if (value instanceof has.List) {
    value.pop(0, value.size);
    value.push(...(raw as unknown[]));
  }
  else if (value instanceof has.Pool) {
    for (const member of [...value]) if (!(raw as unknown[]).includes(member)) value.delete(member);
  }
  else {
    const before = raw as Map<unknown, unknown>;

    for (const key of [...value.keys()]) if (!before.has(key)) value.delete(key);
    for (const [key, item] of before) if (value.get(key) !== item && !dead(item)) value.set(key, item);
  }
}

function record(internal: Internal, entry: Runner.Entry) {
  update(internal, 'record', internal.record.concat(entry));
}

function conclude(internal: Internal, value: unknown) {
  const run = internal.current;

  if (!run || run.halted || run.ending) return;

  release(run);
  end(run, node(run, 'end', value === undefined ? [] : [value]));
}

async function end(run: Run, item = run.end) {
  run.ending = true;

  await drain(run);

  if (run.halted) return;
  if (!item) return finish(run, dump(run.internal));

  const frame = await invoke(run, item);

  if (frame && !run.halted) finish(run, frame.result);
}

function drain(run: Run) {
  if (run.flight.size) return new Promise<void>((resolve) => run.drained.push(resolve));
}

function dump(internal: Internal) {
  const { self, runner } = internal;
  const values = self.get() as Record<string, unknown>;

  return Object.fromEntries(Object.entries(values).filter(([key]) => (self as any)[key] !== runner));
}

function finish(run: Run, value: unknown) {
  const { internal } = run;

  close(run);
  update(internal, 'status', 'idle');
  run.resolve(value);
  advance(internal);
}

function close(run: Run) {
  const { internal } = run;

  internal.current = undefined;
  internal.last = run;
  update(internal, 'runs', internal.runs + 1);
}

function advance(internal: Internal) {
  const next = internal.queued.shift();

  if (!next) return;

  update(internal, 'queue', internal.queued.map((run) => run.args));
  begin(next);
}

function tail(internal: Internal) {
  return internal.queued.at(-1) || internal.current || internal.last;
}

function settled(internal: Internal) {
  if (!internal.current) {
    if (STEP.get(internal.steps.get('next')!)?.length)
      return Promise.reject(new Error(`${internal.self} is idle. next() takes arguments; call it to start a run.`));

    start(internal, []);
  }

  return join(internal);
}

function join(internal: Internal): Promise<unknown> {
  const run = tail(internal)!;

  for (const each of [internal.current, ...internal.queued, run].filter(Boolean)) each!.awaited = true;

  return run.promise.then(
    (value) => (tail(internal) === run ? value : join(internal)),
    (error) => (tail(internal) === run ? Promise.reject(error) : join(internal))
  );
}

function stop(internal: Internal, options: Runner.Stop = {}) {
  const { current, queued, self } = internal;

  if (!current) return;

  const stopped = Object.assign(new Error(`${self} was stopped.`), { name: 'Stopped' });

  for (const run of queued) run.reject(stopped);

  queued.length = 0;
  update(internal, 'queue', []);

  current.stopped = stopped;
  halt(current, 'stopped', undefined, options.undo);
}

function halt(run: Run, status: 'failed' | 'stopped', error?: unknown, undo = status == 'failed') {
  const { internal } = run;

  if (run.halted) return;

  run.halted = status;
  update(internal, 'status', status);

  if (status == 'failed') {
    run.error = error;
    update(internal, 'error', error);
  }

  release(run);
  finalize(run, undo);
}

async function finalize(run: Run, undo: boolean) {
  await drain(run);

  if (undo) {
    await unwind(run);
    back(run);
  }

  const { error } = run;

  close(run);
  run.reject(error === undefined ? run.stopped : error);

  if (error !== undefined)
    queueMicrotask(() => queueMicrotask(() => {
      if (!run.awaited) throw error;
    }));

  advance(run.internal);
}

async function unwind(run: Run) {
  const { internal } = run;
  const { self, record } = internal;

  for (let i = record.length - 1; i >= 0; i--) {
    const entry = record[i];
    const how = run.undo.get(entry.id);

    if (entry.irreversible) {
      entry.halted = true;
      update(internal, 'record', record.slice());
      console.warn(`${self} stopped unwinding at ${entry.id}: ${entry.irreversible.join(', ')} cannot be restored.`);
      break;
    }

    if ('error' in entry) continue;

    try {
      if (how) await undo(run, entry, how);

      restore(self, entry.prior, HELD.get(entry)!);
      entry.undone = true;
    } catch (cause) {
      entry.undone = 'failed';
      run.error = cause;
      update(internal, 'error', cause);
      break;
    } finally {
      update(internal, 'record', record.slice());
    }
  }
}

function back(run: Run) {
  const { internal, error, stopped } = run;

  try {
    hook(internal.self, 'back', error === undefined ? stopped : error);
  } catch (cause) {
    run.error = cause;
    update(internal, 'error', cause);
  }
}

function undo(run: Run, entry: Runner.Entry, how: Function | Runner.Node) {
  const { steps } = run.internal;
  const frame = enter(run, { id: `${entry.id}:undo`, key: entry.key, args: [] });
  const { proxy } = frame;

  frame.undo = true;

  if (typeof how == 'function') return how.call(proxy);

  return STEP.get(steps.get(how.key)!)!.apply(proxy, how.args);
}

export { Job, run, Runner };
