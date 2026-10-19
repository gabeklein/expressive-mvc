import { get, has, map, Model, unbind } from '@expressive/mvc';
import { event, listener, touch } from '@expressive/mvc/observable';

type Collection = has.List<unknown> | has.Pool<unknown> | map.Managed<unknown, unknown>;
type Change = [out: unknown, changed: boolean, undo?: () => void, lost?: boolean];
type Mutator = (...args: any[]) => Change;

interface Held {
  prior: Record<string, unknown>;
  log: (() => void)[];
}

interface Ticket {
  args: unknown[];
  promise: Promise<unknown>;
  resolve(value: unknown): void;
  reject(error: unknown): void;
  awaited?: boolean;
}

interface Answer {
  frame: Promise<Frame | undefined>;
  done(): void;
  fail(error: unknown): void;
}

interface Undo {
  how: Function | Runner.Node;
  from: Frame;
}

interface Back {
  key: string;
  reason: unknown;
}

interface Rescue {
  key?: string;
  fn?: Function;
}

interface Branch {
  failed?: { cause: unknown };
}

interface Lineage {
  retry: number;
  caught: unknown;
}

interface Gate {
  held: Set<Hold>;
  queue: Waiter[];
}

interface Hold {
  run: Run;
  from: string;
}

interface Waiter {
  hold: Hold;
  max(): number;
  grant(): void;
}

const HOOK = /^(before|after)([A-Z]|$)/;
const KEYS = ['status', 'active', 'record', 'queue', 'waiting', 'runs', 'error'] as const;
const SLACK = 8;
const GATES = new WeakMap<object, Gate>();
const INERT = ['back', 'slot'];
const UNCAUGHT = [...INERT, 'end'];
const ISSUED = new WeakMap<object, Frame>();

const TOKEN = {
  catch(this: Runner.Node, handler?: unknown) {
    return ISSUED.get(this)!.rescue(this, handler);
  }
};

declare namespace Runner {
  type Status = 'idle' | 'running' | 'waiting' | 'stopped' | 'failed';

  type Result<T> = (T & { end: unknown })['end'] extends (...args: infer A) => infer R
    ? Awaited<R> extends void ? A[0] : Awaited<R>
    : Model.Values<T>;

  /** A planned item: a step, a parallel group (`group`), or a wait (`answers`). */
  interface Node {
    id: string;
    key: string;
    args: unknown[];
    group?: Node[];
    /** Keys of the steps which may answer this wait. */
    answers?: string[];
    /** Caught by `.catch()`: the handler's key - `then` for a function - or `true` for none. */
    rescue?: string | true;
  }

  /** What a step call inside a step returns - inert, not awaitable. */
  type Token = Readonly<Node>;

  interface Entry {
    id: string;
    key: string;
    args: unknown[];
    next: Node[];
    /** Fields the step wrote, collections changed in place included. */
    wrote: string[];
    /** With `rewind`: values before the step's first write to each. */
    prior?: { [key: string]: unknown };
    /** With `rewind`: values the step left. */
    patch?: { [key: string]: unknown };
    undo?: 'closure' | Node;
    undone?: true | 'failed';
    /** Id of the wait this step answered. */
    wake?: string;
    /** How many times the step was re-run from its own `.catch`, when past the first. */
    retry?: number;
    /** What the step threw - a caught failure, or one which kept its writes. */
    error?: unknown;
    /** Collections changed in a way no restore can undo - the unwind stops here. */
    irreversible?: string[];
    /** The step called `then.commit()` - not retried, not restored, the unwind stops here. */
    committed?: true;
    /** The unwind stopped at this entry; it and every entry before it stay applied. */
    halted?: true;
    /** A `back` entry: id of the entry it went back to, which stays. */
    to?: string;
    /** A `back` entry: the reason given to `back`. A halted entry: the reason given to `stop()` while the unwind was parked here. */
    reason?: unknown;
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

  interface Slot<T = any> {
    /**
     * Slots held at once. Default: no limit. A function taking `$` - the job's tracking proxy - is
     * re-read when anything it read through `$` changes, other Models included; one taking nothing,
     * when a slot frees and when the job updates.
     */
    max?: number | (($: T) => number);
    /** Milliseconds from reaching the slot before it queues. */
    after?: number;
    /** Share the queue: an object across groups and jobs, any other value across this job. Default: the enclosing group's, else the job's. */
    key?: unknown;
  }

  /** How a run ended, given to `exit`. `error` is what the run rejects with; `stopped`, a `stop()` reason given while a failure unwound. */
  type Outcome<R = unknown> =
    | { status: 'done'; result: R }
    | { status: 'failed'; error: unknown; stopped?: unknown }
    | { status: 'stopped'; error: unknown };

  interface Options<T extends Model = Model> {
    /**
     * The topmost class whose methods are steps and hooks - classes above it stay plain.
     * The instance must extend it. Default: the instance's own class only - a runner meant
     * to be extended passes itself.
     */
    base?: abstract new (...args: any[]) => Model;
    /** Keep `prior`/`patch` per entry; the unwind restores committed steps' fields. */
    rewind?: boolean;
    /** Before each step, after the class's `before`. */
    before?: (this: T, step: string, args: unknown[], skip: boolean) => void;
    /** After each step commits, after the class's `after`. */
    after?: (this: T, step: string, entry: Runner.Entry, skip: boolean) => void;
    /** Once an unwind completes, after the class's `back`. A throw replaces the error. */
    back?: (this: T, reason: unknown) => void;
    /** Once per run on every outcome, after the class's `exit`. A throw is reported uncaught; the outcome stands. */
    exit?: (this: T, outcome: Runner.Outcome<Runner.Result<T>>) => void;
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

  interface Controller<T extends Model = Model> {
    /**
     * Inside a step: call `each` per item - a function issuing a step, or a step itself -
     * and run the tokens as one parallel group.
     */
    <I, This>(this: This, items: Iterable<I>, each: (item: I, index: number) => unknown): Promise<void>;

    /**
     * Inside a step: an anonymous step at this point in the plan, given an `AbortSignal` aborted
     * when the run stops. Returned, it is the step's undo. Not durable.
     */
    <This>(this: This, step: (signal: AbortSignal) => unknown): Promise<void>;

    /**
     * Inside a step: park this point in the plan until a call to one of these steps answers it -
     * from outside, or from a watcher: a plain function started when the plan reaches the wait,
     * given an `AbortSignal` aborted once the wait closes. The next step in sequence runs once
     * the answer, and all it schedules, is done. Returned, it parks the unwind until answered.
     */
    <This>(this: This, ...steps: [...steps: ((...args: any[]) => unknown)[], watcher: (signal: AbortSignal) => unknown]): Promise<void>;

    <This>(
      this: This,
      ...steps: [...steps: ((...args: any[]) => unknown)[], watcher: (signal: AbortSignal) => unknown, other: (signal: AbortSignal) => unknown]
    ): Promise<void>;

    <This>(this: This, ...steps: ((...args: any[]) => unknown)[]): Promise<void>;

    /**
     * Inside a step: run these tokens as one parallel group at this point in the plan.
     * The next step in sequence runs once every member, and all it schedules, is done.
     * Returned, its members are the step's undo.
     */
    <This>(this: This, ...steps: unknown[]): Promise<void>;

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
    /**
     * Cancel: discard pending steps and queued runs; in-flight steps settle and commit.
     * `undo` - also unwind the run as a failure would. `reason` - the `cause` of the `'Stopped'`
     * error the run and queue reject with, and its message when a string.
     */
    stop(undo?: boolean, reason?: unknown): void;
    /** Inside a step: a point of no return - the step is not caught, restored or unwound. */
    commit(): void;
    /**
     * Inside a step: wait at this point in the plan for a free slot in a FIFO queue, `after` ms
     * from reaching it. What this step schedules after it runs holding the slot, until done.
     */
    slot(options?: Runner.Slot<T>): void;
    /**
     * Inside a step: unwind every entry committed after `step`'s latest, newest first, discard
     * what they scheduled, then call the `back` hook with `reason`. What this step schedules
     * after it runs next.
     */
    back(step: (...args: any[]) => unknown, reason?: unknown): void;
    /**
     * Inside a step: its `AbortSignal` - aborted on `stop()`, an outside `end`, a failure elsewhere,
     * and once the step settles. A step rejecting with its reason is not a failure.
     */
    readonly signal: AbortSignal;
    /** Inside a step: 0, or one more than the step it re-runs from that step's own `.catch`. */
    readonly retry: number;
    /** Inside a `.catch` handler: what the caught branch threw; else `undefined`. */
    readonly caught: unknown;

    [Symbol.iterator](): Iterator<Runner.Entry>;
  }

  interface Thenable<T extends Model = Model> {
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
type Runner<T extends Model = Model> = Runner.Controller<T> & Runner.Thenable<T>;

/**
 * Make this Model runnable: its methods become steps, each scheduling the next, and the
 * returned Runner is the controller - status, journal, result. `next()` starts a run.
 * `_`-prefixed methods are helpers; `before`/`after`-prefixed ones, `back` and `exit` are hooks.
 */
function run<T extends Model>(self: T, options: Runner.Options<T> = {}): Runner<T> {
  const { base } = options;

  if (base && !(self instanceof base)) throw new Error(`${self} does not extend ${base.name}.`);

  const runner = function (onfulfilled?: unknown, onrejected?: unknown) {
    if (onfulfilled && typeof onfulfilled == 'object') throw new Error('then(steps) must be called inside a step.');

    return control.settled().then(onfulfilled as any, onrejected as any);
  } as Runner<T>;

  const control = Control.new({ _self: self, _runner: runner, _rewind: options.rewind });

  const read: Record<(typeof KEYS)[number], () => unknown> = {
    status: () => control.status,
    active: () => control.active,
    record: () => control.run.record.get(),
    queue: () => control.queue.map((ticket) => ticket.args),
    waiting: () => control.run.waits.map(({ id, step, args, answers }) => ({ id, step, args, answers })),
    runs: () => control.runs,
    error: () => control.error
  };

  for (const key of KEYS)
    Object.defineProperty(runner, key, {
      enumerable: true,
      get(this: object) {
        return touch(this, key, read[key]());
      }
    });

  Object.defineProperties(runner, {
    then: { value: runner },
    on: { value: self },
    get: { value: () => Object.fromEntries(KEYS.map((key) => [key, read[key]()])) },
    end: { value: (value?: unknown) => control.conclude(value) },
    stop: { value: (undo?: boolean, reason?: unknown) => control.stop(undo, reason) },
    commit: { value: () => outside('commit') },
    back: { value: () => outside('back') },
    slot: { value: () => outside('slot') },
    signal: { get: () => outside('signal', 'read') },
    retry: { get: () => outside('retry', 'read') },
    caught: { get: () => outside('caught', 'read') },
    [Symbol.iterator]: {
      value(this: Runner.Controller) {
        return this.record[Symbol.iterator]();
      }
    }
  });

  event(runner);

  const { _hooks: hooks } = control;
  const top = Object.getPrototypeOf(base ? base.prototype : Object.getPrototypeOf(self));

  for (let proto = Object.getPrototypeOf(self); proto !== Model.prototype && proto !== top; proto = Object.getPrototypeOf(proto))
    for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
      let method = desc.get && unbind(desc.get) !== desc.get;
      let skip = !method || key == 'new' || key[0] == '_' || Object.hasOwn(self, key);

      if (skip) continue;

      if (HOOK.test(key) || key == 'back' || key == 'exit') {
        if (!hooks.has(key)) hooks.set(key, [unbind(desc.get!)]);
        continue;
      }

      const step = (...args: unknown[]) => control.call(key, args);

      control._steps.set(key, unbind(desc.get!));
      Object.defineProperty(
        self,
        key,
        key == 'next'
          ? { value: step, writable: true, configurable: true }
          : {
              configurable: true,
              get(this: object) {
                touch(this, key);
                return control.accepts(key) ? step : undefined;
              }
            }
      );
    }

  for (const key of ['before', 'after', 'back', 'exit'] as const) {
    const hook = options[key];

    if (hook) hooks.set(key, [...(hooks.get(key) || []), hook]);
  }

  for (const hook of hooks.keys()) {
    const target = HOOK.test(hook) && hook.replace(HOOK, (_, __, first: string) => first.toLowerCase());

    if (target && !control._steps.has(target)) throw new Error(`${hook} has no step ${target}.`);
  }

  self.get(null, () => control.stop());

  return runner;
}

/**
 * A runnable Model: its methods are steps, `next()` starts a run and `await job` joins it,
 * resolving with the result of `end`. The members below are the contract - each optional.
 */
class Job extends Model {
  /** Keep `prior`/`patch` per entry and restore committed steps' fields on unwind. */
  declare static readonly rewind?: boolean;

  /** The controller - status, journal, queue, waits; awaiting the instance awaits it. */
  readonly then = run(this, { base: Job, rewind: (this.constructor as typeof Job).rewind });

  /** The entry: starts a run, or queues one while a run is active. Settles with its run. */
  next?(...args: any[]): unknown;

  /** Runs last in a run. Its return, else its argument, else a dump of public values, is the result. */
  protected end?(value?: any): unknown;

  /** Before each step, once per step. `skip` is true when the step is replayed. */
  protected before?(step: string, args: unknown[], skip: boolean): void;

  /** After each step commits, once per step. `skip` is true when the step is replayed. */
  protected after?(step: string, entry: Runner.Entry, skip: boolean): void;

  /** Once an unwind completes, halted or not: given `reason` from `then.back()`, else the error the run rejects with. */
  protected back?(reason: unknown): void;

  /** Once per run on every outcome, last before the run settles. A throw is reported uncaught; the outcome stands. */
  protected exit?(outcome: Runner.Outcome): void;
}

class Control extends Model {
  status: Runner.Status = 'idle';
  active: string | undefined = undefined;
  runs = 0;
  error: unknown = undefined;
  queue = has<Ticket>();
  run = new Run();

  _self!: Model;
  _runner!: object;
  _rewind?: boolean = undefined;
  _steps = new Map<string, Function>();
  _hooks = new Map<string, Function[]>();
  _gates = new Map<unknown, Gate>();
  _current?: Run = undefined;

  protected new() {
    const { _runner } = this;

    listener(this.queue, (key) => {
      if (signal(key)) event(this, 'queue');
    });

    return this.set((key) => void event(_runner, key == 'run' ? 'record' : (key as string)));
  }

  call(key: string, args: unknown[]) {
    if (key == 'next') return this.start(args);

    const { _current: current } = this;
    const wait = current && current.route(key, args);

    if (wait) return current!.wake(wait, key, args);

    throw new Error(`${key} cannot be called from outside; call next() to run.`);
  }

  accepts(key: string) {
    return !!this._current?.accepts(key);
  }

  hook(key: string, ...args: unknown[]) {
    for (const hook of this._hooks.get(key) || []) hook.apply(this._self, args);
  }

  start(args: unknown[]) {
    const ticket = { args } as Ticket;

    ticket.promise = new Promise((resolve, reject) => {
      ticket.resolve = resolve;
      ticket.reject = reject;
    });

    ticket.promise.catch(() => {});

    if (this._current) this.queue.push(ticket);
    else this.begin(ticket);

    return handle(ticket, ticket.promise.then());
  }

  begin(ticket: Ticket) {
    const run = new Run({ _ticket: ticket });

    this._current = this.run = run;
    this.error = undefined;
    this.status = 'running';

    run.start();
  }

  advance() {
    const next = this.queue.pop(0);

    if (next) this.begin(next);
  }

  tail() {
    return this.queue.get(-1) || this.run._ticket;
  }

  settled() {
    if (!this._current) {
      if (this._steps.get('next')?.length)
        return Promise.reject(new Error(`${this._self} is idle. next() takes arguments; call it to start a run.`));

      this.start([]);
    }

    return this.join();
  }

  join(): Promise<unknown> {
    const ticket = this.tail()!;
    const tickets = [this._current?._ticket, ...this.queue, ticket].filter(Boolean) as Ticket[];

    for (const each of tickets) each.awaited = true;

    return ticket.promise.then(
      (value) => (this.tail() === ticket ? value : this.join()),
      (error) => (this.tail() === ticket ? Promise.reject(error) : this.join())
    );
  }

  conclude(value: unknown) {
    const { _current: run } = this;

    if (!run || run._halted || run._ending) return;

    run.release();

    for (const frame of run.flight()) frame._abort.abort();

    run.end(run.node('end', value === undefined ? [] : [value]));
  }

  stop(undo?: boolean, reason?: unknown) {
    const { _current: current, queue } = this;

    if (!current) return;

    const message = typeof reason == 'string' ? reason : `${this._self} was stopped.`;
    const stopped = Object.assign(new Error(message, reason === undefined ? undefined : { cause: reason }), { name: 'Stopped' });

    for (const ticket of queue) ticket.reject(stopped);

    queue.clear();

    if (current._halted == 'failed') current._cut = { reason };

    current._stopped = stopped;
    current.release();
    current.halt('stopped', undefined, undo);
  }
}

class Run extends Model {
  control = get(Control);
  record = has<Runner.Entry>();
  frames = has(Frame);
  waits = has(Wait);

  _ticket!: Ticket;
  _counts = new Map<string, number>();
  _undo = new Map<string, Undo>();
  _held = new Map<string, Held>();
  _inline = new Map<string, Function>();
  _owner = new Map<string, Frame>();
  _watchers = new Map<string, Function[]>();
  _backs = new Map<string, Back>();
  _parent = new Map<string, string>();
  _slots = new Map<string, Runner.Slot>();
  _catches = new Map<string, Rescue>();
  _branches = new Map<string, Branch>();
  _lineage = new Map<string, Lineage>();
  _gates = new Map<string, Gate>();
  _groups = new Set<string>();
  _pending = new Map<string, () => void>();
  _holding = new Map<() => void, string>();
  _dropped = new Set<string>();
  _kept = new Set<string>();
  _spent = new Set<string>();
  _backing?: Promise<void> = undefined;
  _drained: (() => void)[] = [];
  _end?: Runner.Node = undefined;
  _halted?: 'failed' | 'stopped' = undefined;
  _ending?: boolean = undefined;
  _error?: unknown = undefined;
  _stopped?: Error = undefined;
  _warned?: boolean = undefined;
  _backed?: boolean = undefined;
  _cut?: { reason: unknown } = undefined;

  protected new() {
    const { control } = this;

    listener(this.record, (key) => {
      if (signal(key) && control.run === this) event(control, 'record');
    });

    listener(this.waits, (key) => {
      let current = signal(key) && control._current === this;

      if (!current) return;

      event(control, 'waiting');

      control.status = this.waits.size ? 'waiting' : this._halted || 'running';
    });
  }

  start() {
    this.exec(this.node('next', this._ticket.args)).then(() => {
      if (!this._halted && !this._ending) this.end();
    });
  }

  node(key: string, args: unknown[]): Runner.Node {
    const count = (this._counts.get(key) || 0) + 1;

    this._counts.set(key, count);

    return Object.assign(Object.create(TOKEN), { id: `${key}#${count}`, key, args }) as Runner.Node;
  }

  route(key: string, args: unknown[], from?: Frame) {
    const open = this.waits.filter((wait) => wait.answers.includes(key));

    return open.find((wait) => wait._from === from) || open.find((wait) => wait.args[0] === args[0]) || open[0];
  }

  accepts(key: string, except?: Wait) {
    return this.waits.any((wait) => wait !== except && wait._open && wait.answers.includes(key));
  }

  flight() {
    return this.frames.filter((frame) => !frame._undo);
  }

  stale() {
    return !!(this._halted || this._ending);
  }

  dropped(id: string) {
    for (const at of this.line(id)) {
      if (this._kept.has(at)) return false;
      if (this._dropped.has(at)) return true;
    }

    return false;
  }

  line(id: string) {
    const ids: string[] = [];

    for (let at: string | undefined = id; at; at = this._parent.get(at)) ids.push(at);

    return ids;
  }

  async exec(item: Runner.Node, from?: Frame): Promise<void> {
    if (this.stale() || this.dropped(item.id)) return;

    const rescue = this._catches.get(item.id);

    if (rescue && !this._branches.has(item.id)) return this.guard(item, from!, rescue);

    if (item.group) {
      await Promise.all(item.group.map((member) => this.exec(member, from)));
      return;
    }

    if (item.answers) {
      const answer = await this.park(item, from!);

      if (answer) {
        await this.descend(await answer.frame);
        answer.done();
      }
    }
    else if (item.key == 'back') await this.back(item, from!);
    else if (item.key != 'end') await this.descend(await this.invoke(item));
  }

  back(item: Runner.Node, from: Frame) {
    const prior = this._backing;

    return (this._backing = (async () => {
      await prior;
      await this.retreat(item, from);
    })());
  }

  async guard(item: Runner.Node, from: Frame, rescue: Rescue) {
    const branch: Branch = {};

    this._branches.set(item.id, branch);

    await this.exec(item, from);

    this._branches.delete(item.id);

    if (!branch.failed) return;

    const prior = this._backing;
    const recovered = (this._backing = (async () => {
      await prior;
      await this.recover(item);
    })());

    await recovered;

    if (this.stale() || !rescue.fn) return;

    const { key, fn } = rescue;
    const { cause } = branch.failed;
    const node = this.node(key || 'then', key ? item.args : []);
    const issuer = key != item.key && key == from.key;
    const repeats = key == item.key ? 0 : issuer ? from._retry : -1;

    this._parent.set(node.id, this._parent.get(item.id)!);
    this._lineage.set(node.id, { retry: repeats + 1, caught: cause });

    if (!key) {
      this._inline.set(node.id, fn);
      this._owner.set(node.id, from);
    }

    if (issuer) for (const [release, id] of this._holding) if (id == from.id) release();

    await this.exec(node, from);
  }

  async recover(item: Runner.Node) {
    const entries = this.record.get() as Runner.Entry[];
    const ids = entries.filter((entry) => !this._spent.has(entry.id) && this.line(entry.id).includes(item.id));
    const failed = await this.unwind(new Set(ids.map((entry) => entry.id)));

    if (failed) this.halt('failed', failed.cause);
  }

  caught(error: unknown, id: string) {
    const at = !this.stale() && this.line(id).find((each) => this._branches.has(each));

    if (!at) return false;

    const branch = this._branches.get(at)!;

    if (branch.failed) return true;

    branch.failed = { cause: error };
    this._dropped.add(at);

    for (const frame of this.discard()) frame._abort.abort();

    return true;
  }

  fail(error: unknown, id: string) {
    if (!this.caught(error, id)) this.halt('failed', error);
  }

  discard() {
    if (this._end && this.dropped(this._end.id)) this._end = undefined;

    for (const wait of this.waits.filter((wait) => !wait._undo && this.dropped(wait.id))) this.waits.delete(wait);
    for (const [id, cancel] of this._pending) if (this.dropped(id)) cancel();

    return this.flight().filter((frame) => this.dropped(frame.id));
  }

  async retreat(item: Runner.Node, from: Frame) {
    if (this.stale() || this.dropped(item.id)) return;

    const { record } = this;
    const { key, reason } = this._backs.get(item.id)!;
    const entries = record.get() as Runner.Entry[];
    const live = (entry: Runner.Entry) => entry.id != from.id && !('error' in entry) && !this._spent.has(entry.id);
    const at = entries.findLastIndex((entry) => entry.key == key && live(entry));

    if (at < 0) return this.halt('failed', new Error(`back() found no committed ${key}.`));

    const ids = new Set(entries.slice(at + 1).filter(live).map((entry) => entry.id));

    for (const id of ids) {
      this._dropped.add(id);
      this._kept.delete(id);
    }

    this._kept.add(from.id);

    const flying = this.discard();

    for (const frame of flying) {
      frame._abort.abort();
      ids.add(frame.id);
    }

    await Promise.all(flying.map((frame) => frame._gone));

    if (this.stale()) return;

    const failed = await this.unwind(ids);

    if (failed) return this.halt('failed', failed.cause);
    if (this.stale()) return;

    const entry: Runner.Entry = { id: item.id, key: 'back', args: [], next: [], wrote: [], to: entries[at].id };

    if (reason !== undefined) entry.reason = reason;

    this._spent.add(item.id);
    record.push(entry);

    const thrown = this.fire('back', reason);

    if (thrown) {
      this._backed = true;
      return this.halt('failed', thrown.cause);
    }

    const rest = from._items.slice(from._items.indexOf(item) + 1);

    for (const end of rest.filter((each) => each.key == 'end')) {
      if (this._end) return this.halt('failed', new Error('end was scheduled twice.'));

      this._end = end;
    }
  }

  async descend(frame?: Frame) {
    if (frame) await this.sequence(frame._items, frame);
  }

  async sequence(items: Runner.Node[], from: Frame): Promise<void> {
    for (const [index, item] of items.entries()) {
      if (item.key != 'slot') {
        await this.exec(item, from);
        continue;
      }

      const release = await this.acquire(item, from);

      if (!release) return;

      try {
        await this.sequence(items.slice(index + 1), from);
      } finally {
        release();
      }

      return;
    }
  }

  acquire(item: Runner.Node, from: Frame) {
    if (this.stale() || this.dropped(item.id)) return;

    const { id } = item;
    const { max = Infinity, after = 0, key } = this._slots.get(id)!;
    const gate = this.gate(from, key);
    const line = this.line(from.id);
    const hold: Hold = { run: this, from: from.id };
    const inside = [...gate.held].some((each) => each.run === this && line.includes(each.from));
    const self = this.control._self;

    return new Promise<(() => void) | undefined>((resolve) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let quiet: (() => void) | undefined;
      let limit = 0;
      let over = false;

      const finish = (release?: () => void) => {
        over = true;
        clearTimeout(timer);
        quiet?.();
        this._pending.delete(id);
        resolve(release);
      };

      const release = () => {
        if (!gate.held.delete(hold)) return;

        this._holding.delete(release);
        pump(gate);
      };

      const waiter: Waiter = {
        hold,
        max: typeof max != 'function' ? () => max : max.length ? () => limit : (max as () => number),
        grant: () => {
          this._holding.set(release, from.id);
          finish(release);
        }
      };

      const join = () => {
        if (inside) return finish(() => {});

        if (typeof max == 'function')
          quiet = max.length
            ? self.get(($) => {
                limit = max($);
                pump(gate);

                return over ? null : undefined;
              })
            : listener(self, (key) => void (signal(key) && pump(gate)));

        gate.queue.push(waiter);
        pump(gate);
      };

      this._pending.set(id, () => {
        gate.queue = gate.queue.filter((each) => each !== waiter);
        finish();
      });

      if (after > 0) timer = setTimeout(join, after);
      else join();
    });
  }

  gate(from: Frame, key: unknown) {
    const { control } = this;

    if (key instanceof Object) return gate(GATES, key);
    if (key !== undefined) return gate(control._gates, key);

    const group = this.line(from.id).find((id) => this._groups.has(id));

    return group ? gate(this._gates, group) : gate(control._gates, control);
  }

  park(item: Runner.Node, from: Frame, undo?: boolean) {
    let closures = [...this._undo.values()].some(({ how }) => typeof how == 'function');

    if (closures && !this._warned) {
      this._warned = true;
      console.warn(`${this.control._self} is waiting with undo closures held; a closure does not survive a resume.`);
    }

    return new Promise<Answer | undefined>((resolve, reject) => {
      const { id, answers } = item;
      const wait = this.waits.add({ id, step: from.key, args: from.args, answers, _from: from, _undo: undo, _park: resolve, _fail: reject });

      for (const watcher of this._watchers.get(item.id) || []) wait.watch(watcher);
    });
  }

  wake(wait: Wait, key: string, args: unknown[]) {
    const { _ticket } = this;
    let done!: () => void;
    let fail!: (error: unknown) => void;

    const answered = new Promise<void>((res, rej) => {
      done = res;
      fail = rej;
    });

    const answer = { done: () => (this._halted && !wait._undo ? _ticket.promise.catch(fail) : done()), fail } as Answer;

    const node = this.node(key, args);

    wait._answer = answer;
    this._parent.set(node.id, wait.id);
    this.waits.delete(wait);
    answer.frame = this.invoke(node, wait.id, wait._undo);

    return handle(_ticket, answered);
  }

  release() {
    this.waits.clear();

    for (const cancel of this._pending.values()) cancel();
    for (const release of this._holding.keys()) release();
  }

  async invoke(node: Runner.Node, wake?: string, undo?: boolean): Promise<Frame | undefined> {
    const { control } = this;
    const { id, key, args } = node;
    const inline = this._inline.get(id);
    const lineage = this._lineage.get(id);
    const fn = inline || control._steps.get(key) || (() => {});
    const frame = this.frames.add({ id, key, args, _wake: wake, _undo: undo, _owner: this._owner.get(id), ...lineage && { _retry: lineage.retry, _caught: lineage.caught } });
    const input = inline ? [lineage ? lineage.caught : frame._abort.signal] : args;
    const hooks = !undo;
    let body = false;

    control.active = key;

    try {
      if (hooks) {
        control.hook('before', key, args, false);
        control.hook(`before${capital(key)}`, false, ...args);
      }

      for (;;)
        try {
          const out = await fn.apply(frame._proxy, input);

          frame._settled = true;

          const entry = frame.commit(out);

          if (hooks) {
            control.hook(`after${capital(key)}`, false, entry);
            control.hook('after', key, entry, false);
          }

          return frame;
        } catch (thrown) {
          let error = thrown;
          let irreversible = [...frame._lost];
          let fixed = irreversible.length || frame._committed;

          body = !frame._settled;

          if (error instanceof Promise && body && !fixed) {
            this.reset(frame);

            const failed = await frame.pause(error);

            if (!failed) continue;

            error = failed.cause;
          }

          if (fixed) this.record.push({ ...frame.journal(), error, ...irreversible.length && { irreversible } });

          throw error;
        }
    } catch (error) {
      const { signal } = frame._abort;
      const fixed = frame._lost.size || frame._committed;

      frame._settled = true;

      if (!fixed) this.restore(frame._prior, frame._log);
      if (undo) throw error;
      if (signal.aborted && error === signal.reason) return;

      if (body && !fixed && this.caught(error, id))
        this.record.push({ id, key, args, next: [], wrote: [], error, ...frame._retry && { retry: frame._retry } });
      else this.halt('failed', error);
    } finally {
      this.frames.delete(frame);
      control.active = this.flight().at(-1)?.key;

      if (!this.flight().length) for (const resolve of this._drained.splice(0)) resolve();
    }
  }

  reset(frame: Frame) {
    this.restore(frame._prior, frame._log);
    frame._armed++;

    Object.assign(frame, {
      _wrappers: new Map(),
      _log: [],
      _before: new Map(),
      _changed: new Set(),
      _items: [],
      _wrote: new Set(),
      _prior: {},
      _violation: undefined,
      _late: undefined
    });
  }

  async end(item = this._end) {
    this._ending = true;

    await this.drain();

    if (this._backing) await this._backing;
    if (this._halted) return;
    if (!item) return this.finish(dump(this.control));

    const frame = await this.invoke(item);

    if (frame && !this._halted) this.finish(frame._result);
  }

  drain() {
    if (this.flight().length) return new Promise<void>((resolve) => this._drained.push(resolve));
  }

  finish(value: unknown) {
    const { control } = this;

    this.exit({ status: 'done', result: value });
    this.close();
    control.status = 'idle';
    this._ticket.resolve(value);
    control.advance();
  }

  close() {
    const { control } = this;

    control._current = undefined;
    control.runs++;
    this.frames.clear();
    this.waits.clear();
  }

  halt(status: 'failed' | 'stopped', error?: unknown, undo = status == 'failed') {
    const { control } = this;

    if (this._halted) return;

    this._halted = status;
    control.status = status;

    for (const frame of this.frames) frame._abort.abort();

    if (status == 'failed') {
      this._error = error;
      control.error = error;
    }

    this.release();
    this.finalize(undo);
  }

  async finalize(undo: boolean) {
    await this.drain();

    if (this._backing) await this._backing;

    if (undo) {
      const failed = await this.unwind();

      if (failed) this.blame(failed.cause);
      if (!this._backed) this.fire('back', this.reason());
    }

    const { _cut: cut } = this;
    const error = this.reason();

    this.exit(cut ? { status: 'failed', error, stopped: cut.reason } : { status: this._halted!, error });
    this.reject();
  }

  reason() {
    const { _error: error } = this;

    return error === undefined ? this._stopped : error;
  }

  reject() {
    const { _error: error, _ticket } = this;

    this.close();
    _ticket.reject(this.reason());

    if (error !== undefined)
      queueMicrotask(() => queueMicrotask(() => {
        if (!_ticket.awaited) throw error;
      }));

    this.control.advance();
  }

  async unwind(ids?: Set<string>) {
    const { control, record } = this;
    const { _rewind: rewind } = control;
    const entries = record.get() as Runner.Entry[];

    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const undo = this._undo.get(entry.id);

      if (ids ? !ids.has(entry.id) : this._spent.has(entry.id)) continue;
      if (ids && this.stale()) return;
      if (entry.undone == 'failed') break;

      if (entry.irreversible || entry.committed) {
        entry.halted = true;
        event(record, i);

        if (entry.irreversible)
          console.warn(`${control._self} stopped unwinding at ${entry.id}: ${entry.irreversible.join(', ')} cannot be restored.`);

        break;
      }

      if ('error' in entry) continue;

      try {
        let done = !undo || (await this.undo(entry, undo.how, undo.from));

        if (!done && ids && this.stale()) return;

        if (!done) {
          entry.halted = true;

          if (this._cut && this._cut.reason !== undefined) entry.reason = this._cut.reason;

          break;
        }

        if (rewind) {
          const { prior, log } = this._held.get(entry.id)!;

          this.restore(prior, log);
        }
        if (undo || rewind) entry.undone = true;

        this._spent.add(entry.id);
      } catch (cause) {
        entry.undone = 'failed';
        return { cause };
      } finally {
        event(record, i);
      }
    }
  }

  fire(key: string, arg: unknown) {
    const { control } = this;
    let thrown: { cause: unknown } | undefined;

    for (const hook of control._hooks.get(key) || [])
      try {
        hook.call(control._self, arg);
      } catch (cause) {
        this.blame(cause);
        thrown = { cause };
      }

    return thrown;
  }

  exit(outcome: Runner.Outcome) {
    const { control } = this;

    for (const hook of control._hooks.get('exit') || [])
      try {
        hook.call(control._self, outcome);
      } catch (cause) {
        queueMicrotask(() => {
          throw cause;
        });
      }
  }

  blame(cause: unknown) {
    this._error = cause;
    this.control.error = cause;
  }

  async undo(entry: Runner.Entry, how: Function | Runner.Node, from: Frame): Promise<boolean> {
    if (typeof how != 'function' && how.group) {
      const done = await Promise.all(how.group.map((member) => this.undo(entry, member, from)));

      return done.every(Boolean);
    }

    if (typeof how != 'function' && how.answers) return this.compensate(how, from);

    const frame = this.frames.add({ id: `${entry.id}:undo`, key: entry.key, args: [], _undo: true });
    const { _proxy } = frame;
    const inline = typeof how != 'function' && this._inline.get(how.id);

    try {
      if (typeof how == 'function') await how.call(_proxy);
      else if (inline) await inline.call(_proxy, frame._abort.signal);
      else await this.control._steps.get(how.key)!.apply(_proxy, how.args);

      return true;
    } finally {
      this.frames.delete(frame);
    }
  }

  async compensate(item: Runner.Node, from: Frame) {
    const answer = await this.park(item, from, true);

    if (!answer) return false;

    let frame: Frame | undefined;

    try {
      frame = await answer.frame;
    } catch (error) {
      answer.fail(error);
      throw error;
    }

    answer.done();

    return !frame!._committed;
  }

  restore(prior: Record<string, unknown>, log: (() => void)[]) {
    const self = this.control._self as any;

    for (const key in prior) self[key] = prior[key];
    for (const undo of [...log].reverse()) undo();
  }
}

class Frame extends Model {
  run = get(Run);
  id = '';
  key = '';
  args: unknown[] = [];

  _proxy!: Model;
  _owner?: Frame = undefined;
  _view?: Runner.Controller = undefined;
  _refs = new Map<string, Function>();
  _abort = new AbortController();
  _items: Runner.Node[] = [];
  _wrote = new Set<string>();
  _prior: Record<string, unknown> = {};
  _wrappers = new Map<Collection, Collection>();
  _log: (() => void)[] = [];
  _before = new Map<string, unknown>();
  _changed = new Set<string>();
  _lost = new Set<string>();
  _wake?: string = undefined;
  _undo?: boolean = undefined;
  _retry = 0;
  _caught?: unknown = undefined;
  _committed?: boolean = undefined;
  _violation?: string = undefined;
  _late?: boolean = undefined;
  _armed = 0;
  _settled?: boolean = undefined;
  _result?: unknown = undefined;
  _left!: () => void;
  _gone = new Promise<void>((resolve) => (this._left = resolve));

  protected new() {
    const { _self: self, _steps, _runner } = this.run.control;

    this._proxy = new Proxy(self, {
      get: (target, prop) => {
        const live = this._settled && this.live();

        if (live) return Reflect.get(live._proxy, prop);
        if (_steps.has(prop as string)) return this.ref(prop as string);

        const value = Reflect.get(target, prop, target);

        if (value === _runner) return this.view();
        if (typeof value != 'function') {
          let managed = !this._undo && !this._settled && collection(value);

          return managed ? this.wrap(prop as string, value) : value;
        }

        return Object.hasOwn(target, prop) ? value : value.bind(target);
      },
      set: (target, prop, value) => {
        const key = String(prop);

        if (this._settled) {
          const live = this.live();

          return live ? Reflect.set(live._proxy, prop, value) : Reflect.set(target, prop, value, target);
        }

        if (!this._wrote.has(key)) {
          this._prior[key] = Reflect.get(target, prop, target);
          this._wrote.add(key);
        }

        if (this._items.length) this._violation ||= key;

        return Reflect.set(target, prop, value, target);
      }
    });

    return () => {
      this._abort.abort();
      this._left();
    };
  }

  live() {
    const { run } = this;

    if (run.waits.any((wait) => wait._from === this)) return;

    const live = run.flight().filter((frame) => frame.within(this));

    return live.length == 1 ? live[0] : undefined;
  }

  within(owner: Frame) {
    for (let at = this._owner; at; at = at._owner) if (at === owner) return true;

    return false;
  }

  ref(key: string) {
    let ref = this._refs.get(key);

    if (!ref) this._refs.set(key, (ref = (...args: unknown[]) => (this._settled ? this.answer(key, args) : this.issue(key, args))));

    return ref;
  }

  keyOf(fn: unknown) {
    for (const [key, ref] of this._refs) if (ref === fn) return key;
  }

  issue(key: string, args: unknown[]) {
    const { run } = this;

    if (this._undo) throw new Error(`${run.control._self} is ${run.control.status}; ${key} cannot run.`);
    if (this._settled) throw new Error(`${this.key} has settled; ${key} cannot run.`);

    const token = run.node(key, args);

    ISSUED.set(token, this);
    this._items.push(token);
    this.arm();

    return token;
  }

  answer(key: string, args: unknown[]) {
    const { run } = this;
    let live = run.control._current === run;
    const wait = live && run.route(key, args, this);

    if (wait) return run.wake(wait, key, args);

    throw new Error(`${this.key} has settled; ${key} cannot run.`);
  }

  async pause(pending: Promise<unknown>) {
    const { signal } = this._abort;
    const abort = new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
    let failed: { cause: unknown } | undefined;

    if (!signal.aborted) await Promise.race([pending, abort]).catch((cause) => (failed = { cause }));
    if (signal.aborted) throw signal.reason;

    return failed;
  }

  arm() {
    const armed = ++this._armed;
    let hops = SLACK;

    const tick = () => {
      if (this._settled || this._armed != armed) return;
      if (--hops) queueMicrotask(tick);
      else this._late = true;
    };

    queueMicrotask(tick);
  }

  view(): Runner.Controller {
    if (this._view) return this._view;

    const view = (...args: unknown[]) => {
      const [items, each] = args as [unknown, (item: unknown, index: number) => unknown];
      const fns = args.filter((arg) => typeof arg == 'function');
      const refs = fns.map((fn) => this.keyOf(fn)).filter(Boolean) as string[];
      let mapped = args.length == 2 && iterable(items) && typeof each == 'function';
      let grouped = args.length && args.every((arg) => arg && typeof arg == 'object');
      let functions = args.length && fns.length == args.length;
      let mixed = fns.length && args.some((arg) => arg && typeof arg == 'object');

      if (mapped) return this.group(Array.from(items as Iterable<unknown>, each));
      if (grouped) return this.group(args);
      if (functions && refs.length) return this.wait(refs, fns.filter((fn) => !this.keyOf(fn)));
      if (functions && args.length == 1) return this.inline(items as Function);
      if (mixed) throw new Error('then() takes called steps or step references, not both.');

      throw new Error('a step cannot await its own run.');
    };

    Object.setPrototypeOf(view, this.run.control._runner);
    Object.defineProperties(view, {
      then: { value: view },
      end: { value: (value?: unknown) => this.issue('end', value === undefined ? [] : [value]) },
      signal: { get: () => this._abort.signal },
      retry: { get: () => this._retry },
      caught: { get: () => this._caught },
      back: { value: (step?: unknown, reason?: unknown) => this.back(step, reason) },
      slot: { value: (options: Runner.Slot = {}) => this.slot(options) },
      commit: {
        value: () => {
          if (this._settled) throw new Error(`${this.key} has settled; commit cannot run.`);

          this._committed = true;
        }
      }
    });

    return (this._view = view as unknown as Runner.Controller);
  }

  back(step: unknown, reason: unknown) {
    const { run } = this;
    const key = this.keyOf(step);

    if (!key || key == 'end') throw new Error('back() takes a step to go back to; stop(true) unwinds the whole run.');

    const token = this.issue('back', []);

    run._backs.set(token.id, { key, reason });

    return token;
  }

  rescue(token: Runner.Node, handler: unknown) {
    const key = this.keyOf(handler);

    if (UNCAUGHT.includes(token.key)) throw new Error(`${token.key}() cannot be caught.`);
    if (handler && typeof handler != 'function') throw new Error('catch() takes a step, a function or nothing.');

    token.rescue = handler ? key || 'then' : true;
    this.run._catches.set(token.id, { key, fn: handler as Function | undefined });

    return token;
  }

  slot(options: Runner.Slot) {
    const token = this.issue('slot', []);

    this.run._slots.set(token.id, options);

    return token;
  }

  group(members: unknown[]) {
    for (const member of members as Runner.Node[])
      if (!this._items.includes(member)) throw new Error(`then() takes steps called by ${this.key}.`);
      else if (INERT.includes(member.key)) throw new Error(`${member.key}() cannot be grouped.`);

    const group = Object.assign(this.run.node('then', []), { group: members as Runner.Node[] });

    ISSUED.set(group, this);
    this.run._groups.add(group.id);

    this._items = this._items.filter((item) => !members.includes(item));
    this._items.push(group);
    this.arm();

    return group;
  }

  inline(fn: Function) {
    const token = this.issue('then', []);

    this.run._inline.set(token.id, fn);
    this.run._owner.set(token.id, this);

    return token;
  }

  wait(answers: string[], watchers: Function[]) {
    for (const key of answers) if (key == 'next' || key == 'end') throw new Error(`${key} cannot answer a wait.`);

    const token = Object.assign(this.issue('wait', []), { answers });

    if (watchers.length) this.run._watchers.set(token.id, watchers);

    return token;
  }

  commit(out: unknown) {
    const { run, id, key, args, _items: items, _violation, _late, _wake, _lost } = this;

    if (_violation) throw new Error(`${key} wrote ${_violation} after scheduling ${items[0].key}.`);
    if (_late) throw new Error(`${key} kept working after scheduling ${items[0].key}.`);

    let undo: Function | Runner.Node | undefined;
    let token = items.includes(out as Runner.Node) && !INERT.includes((out as Runner.Node).key);

    if (key == 'end') {
      if (items.length) throw new Error(`end cannot schedule ${items[0].key}.`);

      this._result = out !== undefined ? out : args.length ? args[0] : dump(run.control);
    }
    else if (typeof out == 'function') undo = out;
    else if (token) {
      undo = out as Runner.Node;
      items.splice(items.indexOf(undo), 1);
    }
    else if (out !== undefined) throw new Error(`${key} returned a value; a step returns nothing, or its undo.`);

    for (const item of items) {
      if (item.key == 'back') break;
      if (item.key != 'end') continue;
      if (run._end) throw new Error('end was scheduled twice.');

      run._end = item;
    }

    adopt(run._parent, items, id);

    const entry: Runner.Entry = { ...this.journal(), next: items };

    if (_wake) entry.wake = _wake;
    if (this._retry) entry.retry = this._retry;

    if (undo) {
      entry.undo = typeof undo == 'function' ? 'closure' : undo;
      run._undo.set(id, { how: undo, from: this });
    }
    else if (_lost.size) entry.irreversible = [..._lost];

    if (run.control._rewind) run._held.set(id, { prior: this._prior, log: this._log });
    if (this._undo) run._spent.add(id);

    run.record.push(entry);

    return entry;
  }

  journal(): Runner.Entry {
    const { run, id, key, args, _wrote, _prior, _before, _changed, _committed } = this;
    const wrote = [...new Set([..._wrote, ..._changed])];
    const entry: Runner.Entry = { id, key, args, next: [], wrote };

    if (_committed) entry.committed = true;

    if (run.control._rewind) {
      const values = run.control._self.get() as Record<string, unknown>;
      const collections = [..._changed].map((key) => [key, _before.get(key)]);

      entry.prior = { ..._prior, ...Object.fromEntries(collections) };
      entry.patch = Object.fromEntries(wrote.map((key) => [key, values[key]]));
    }

    return entry;
  }

  wrap(key: string, value: Collection) {
    let wrapper = this._wrappers.get(value);

    if (wrapper) return wrapper;

    const ops = mutators(value);

    wrapper = new Proxy(value, {
      get: (target, prop) => {
        const op = ops[prop as string];

        if (op)
          return (...args: unknown[]) => {
            const out = this.change(key, target, () => op(...args));

            return out === target ? wrapper : out;
          };

        const got = Reflect.get(target, prop, target);

        return typeof got == 'function' ? got.bind(target) : got;
      }
    });

    this._wrappers.set(value, wrapper);

    return wrapper;
  }

  change(key: string, value: Collection, op: () => Change) {
    const at = this._settled ? this.live() : this;

    if (!at) return op()[0];

    if (at.run.control._rewind && !at._before.has(key)) at._before.set(key, value.get());

    const [out, changed, undo, lost] = op();

    if (!changed) return out;
    if (at._items.length) at._violation ||= key;
    if (undo) at._log.push(undo);
    if (lost) at._lost.add(key);

    at._changed.add(key);

    return out;
  }
}

class Wait extends Model {
  run = get(Run);
  id = '';
  step = '';
  args: unknown[] = [];
  answers: string[] = [];

  _from!: Frame;
  _undo?: boolean = undefined;
  _park!: (answer?: Answer) => void;
  _fail!: (error: unknown) => void;
  _answer?: Answer = undefined;
  _abort = new AbortController();
  _open = true;

  protected new() {
    const { run, answers } = this;
    const { _self: self } = run.control;

    for (const key of answers) if (!run.accepts(key, this)) event(self, key);

    return () => {
      this._open = false;

      for (const key of answers) if (!run.accepts(key)) event(self, key);

      this._abort.abort();
      this._park(this._answer);
    };
  }

  watch(watcher: Function) {
    const { signal } = this._abort;

    (async () => watcher.call(this._from._proxy, signal))().catch((error) => this.fail(error));
  }

  fail(error: unknown) {
    const { run } = this;

    if (!this._open) return;
    if (!this._undo) return run.fail(error, this.id);

    this._fail(error);
    run.waits.delete(this);
  }
}

function signal(key: unknown) {
  return typeof key != 'boolean' && key !== null;
}

function iterable(value: unknown): value is Iterable<unknown> {
  return value != null && typeof (value as Iterable<unknown>)[Symbol.iterator] == 'function';
}

function outside(key: string, verb = 'called'): never {
  throw new Error(`${key} must be ${verb} inside a step.`);
}

function handle<T>(ticket: Ticket, out: Promise<T>) {
  out.catch(() => {});

  return Object.defineProperty(out, 'then', {
    value(this: Promise<unknown>, ...args: Parameters<Promise<unknown>['then']>) {
      ticket.awaited = true;
      return Promise.prototype.then.apply(this, args);
    }
  });
}

function gate<K>(gates: { get(key: K): Gate | undefined; set(key: K, gate: Gate): unknown }, key: K) {
  let gate = gates.get(key);

  if (!gate) gates.set(key, (gate = { held: new Set(), queue: [] }));

  return gate;
}

function pump(gate: Gate) {
  for (let next = gate.queue[0]; next && gate.held.size < next.max(); next = gate.queue[0]) {
    gate.queue.shift();
    gate.held.add(next.hold);
    next.grant();
  }
}

function adopt(parents: Map<string, string>, items: Runner.Node[], parent: string) {
  for (const item of items) {
    parents.set(item.id, parent);

    if (item.group) adopt(parents, item.group, item.id);
  }
}

function capital(key: string) {
  return key[0].toUpperCase() + key.slice(1);
}

function dump({ _self: self, _runner }: Control) {
  const values = self.get() as Record<string, unknown>;

  return Object.fromEntries(Object.entries(values).filter(([key]) => (self as any)[key] !== _runner));
}

function collection(value: unknown): value is Collection {
  return value instanceof has.List || value instanceof has.Pool || value instanceof map.Managed;
}

function dead(value: unknown) {
  return value instanceof Model && value.get(null);
}

function mutators(value: Collection): Record<string, Mutator> {
  if (value instanceof has.List) return listOps(value);
  if (value instanceof has.Pool) return poolOps(value);

  return mapOps(value);
}

function listOps(list: has.List<unknown>): Record<string, Mutator> {
  const at = (index: number, size: number) => (index < 0 ? Math.max(size + index, 0) : Math.min(index, size));

  const unput = (start: number, values: unknown[]) => () => {
    for (let i = values.length - 1; i >= 0; i--) {
      const found = near(list, values[i], start + i);

      if (found >= 0) list.pop(found);
    }
  };

  return {
    push: (...values: unknown[]) => {
      const start = list.size;

      return [list.push(...values), values.length > 0, unput(start, values)];
    },
    put: (index: number, ...values: unknown[]) => {
      const start = at(index, list.size);

      list.put(index, ...values);

      return [undefined, values.length > 0, unput(start, values)];
    },
    pop: (index = -1, count?: number) => {
      const before = list.get(0, list.size);
      const start = at(index, before.length);
      const removed = before.slice(start, start + (count ?? 1));
      const out = count === undefined ? list.pop(index) : list.pop(index, count);

      return [out, removed.length > 0, () => list.put(start, ...removed)];
    },
    set: (index: number, value: unknown) => {
      const before = list.get(0, list.size);
      const start = index < 0 ? before.length + index : index;
      const prior = before[start];

      list.set(index, value);

      const restore = () => {
        const found = near(list, value, start);

        if (found >= 0) list.set(found, prior);
      };

      return [undefined, start >= 0 && start < before.length && prior !== value, restore];
    },
    clear: () => {
      const removed = list.get(0, list.size);

      list.clear();

      return [undefined, removed.length > 0, () => list.put(0, ...removed)];
    }
  };
}

function poolOps(pool: has.Pool<unknown>): Record<string, Mutator> {
  const added = new Set<unknown>();

  const lost = (members: unknown[]) => members.filter((member) => !added.delete(member)).length > 0;

  return {
    add: (...args: unknown[]) => {
      const size = pool.size;
      const made = pool.add(...args);
      const fresh = pool.size > size;

      if (fresh) added.add(made);

      return [made, fresh, () => pool.delete(made)];
    },
    delete: (member: unknown) => {
      const had = pool.delete(member);

      return [had, had, undefined, had && lost([member])];
    },
    clear: () => {
      const members = [...pool];

      pool.clear();

      return [undefined, members.length > 0, undefined, lost(members)];
    }
  };
}

function mapOps(map: map.Managed<unknown, unknown>): Record<string, Mutator> {
  const added = new Set<unknown>();

  const removed = (entries: [unknown, unknown][]): Change => {
    const kept = entries.filter(([, value]) => !dead(value));
    const lost = entries.some(([key, value]) => dead(value) && !added.has(key));

    const restore = () => {
      for (const [key, value] of kept) if (!map.has(key)) map.set(key, value);
    };

    return [undefined, entries.length > 0, restore, lost];
  };

  return {
    set: (key: unknown, ...rest: unknown[]) => {
      const had = map.has(key);
      const prior = map.get(key);
      const own = !had || added.has(key);

      map.set(key, ...rest);

      const value = map.get(key);
      const gone = had && dead(prior);

      const restore = () => {
        if (map.get(key) !== value) return;
        if (had && !gone) map.set(key, prior);
        else if (own) map.delete(key);
      };

      added.add(key);

      return [map, !had || value !== prior, restore, gone && !own];
    },
    delete: (key: unknown) => {
      const entry: [unknown, unknown] = [key, map.get(key)];
      const had = map.delete(key);
      const change = removed(had ? [entry] : []);

      change[0] = had;

      return change;
    },
    clear: () => {
      const entries = [...map.entries()];

      map.clear();

      return removed(entries);
    }
  };
}

function near(list: has.List<unknown>, value: unknown, at: number) {
  let found = -1;

  list.get(0, list.size).forEach((item, index) => {
    if (item === value && (found < 0 || Math.abs(index - at) < Math.abs(found - at))) found = index;
  });

  return found;
}

export { Job, run };
export type { Runner };
