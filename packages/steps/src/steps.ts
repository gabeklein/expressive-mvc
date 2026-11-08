import { get, has, map, Model, unbind } from '@expressive/mvc';
import { event, listener, touch, watch } from '@expressive/mvc/observable';

type Collection = has.List<unknown> | has.Pool<unknown> | map.Managed<unknown, unknown>;
type Change = [out: unknown, changed: boolean, undo?: () => void, lost?: boolean];
type Mutator = (...args: any[]) => Change;

type Log = [key: string, undo: () => void][];

interface Held {
  prior: Record<string, unknown>;
  log: Log;
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

type Kind = 'reset' | 'catch' | 'abort' | 'close';
type Mode = 'error' | 'abort' | 'stop';

interface Handler {
  kind: Kind;
  node: Steps.Node;
  bare?: boolean;
}

interface Rescue {
  key?: string;
  fn?: Function;
}

type Restore = (into?: Frame, all?: boolean, within?: string) => void;

interface Unwound {
  undone: Steps.Entry[];
  kept: Set<string>;
  failed?: { cause: unknown };
}

interface Branch {
  failed?: { cause: unknown };
}

interface Lineage {
  restore: Restore;
  caught: Steps.Node;
}

interface Gate {
  held: Set<Hold>;
  queue: Waiter[];
}

interface Hold {
  run: Run;
  from: string;
}

interface Slot {
  max: number | ((...args: any[]) => number);
  key: unknown;
}

interface Waiter {
  hold: Hold;
  max(): number;
  grant(): void;
}

const HOOKS = new Set(['before', 'after']);
const KEYS = ['status', 'active', 'queue', 'waiting', 'runs', 'error'] as const;
const SLACK = 8;
const LONGEST = 2 ** 31 - 1;
const GATES = new WeakMap<object, Gate>();
const UNCAUGHT = ['gate', 'end'];
const UNPLANNED = ['end', 'gate', 'wait'];
const RESERVED = ['then', 'end', 'gate', 'wait'];
const REFRESH = Symbol.for('@expressive/mvc.refresh');
const ISSUED = new WeakMap<object, Frame>();
const RETRY = new WeakSet<Function>();
const RULES = new WeakSet<Error>();
const KINDS: Kind[] = ['reset', 'catch', 'abort', 'close'];
const MODES = { failed: 'error', aborted: 'abort', stopped: 'stop' } as const;
const UNITS: Record<string, number> = { ms: 1, sec: 1e3, min: 6e4, hr: 36e5, day: 864e5 };

const TOKEN = {
  catch(this: Steps.Node, handler?: unknown) {
    return ISSUED.get(this)!.rescue(this, handler);
  }
};

declare namespace Steps {
  type Status = 'idle' | 'running' | 'waiting' | 'stopped' | 'aborted' | 'failed';

  /** What `run` returns - the run's result. */
  type Result<T> = T extends { run(...args: any[]): infer R } ? Awaited<R> : unknown;

  /** A planned item: a step, a parallel group (`group`), or a wait (`answers`). */
  interface Node {
    id: string;
    key: string;
    /** Arguments - a duration wait's milliseconds. */
    args: unknown[];
    group?: Node[];
    /** Keys of the steps which may answer this wait - none for a duration. */
    answers?: string[];
    /** Steps raced against the answers - cancelled once one answers. */
    race?: Node;
    /** Caught by `.catch()`: a step given the error (its key), `then` for a function, or `true` for none. */
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
    /** Handlers the step registered with `then.on()`, by outcome, in order: a step method given uncalled or steps called for one (by key), or `then` for a function. */
    on?: { [K in keyof On]?: Node[] };
    /** Taken back by an unwind - resets run, fields restored; `'failed'` when a handler threw. */
    unwound?: true | 'failed';
    /** Id of the wait this step answered. */
    wake?: string;
    /** How many times `then.retry()` replayed the step, when past its first run. */
    retried?: number;
    /** What the step threw - a caught failure, or one which kept its writes. */
    error?: unknown;
    /** Collections changed in a way no restore can undo - the unwind stops here. */
    irreversible?: string[];
    /** The step called `then.commit()` - not retried, restored or undone; the unwind stops here. */
    committed?: true;
    /** The unwind stopped at this entry; it and every entry before it stay applied. */
    halted?: true;
    /** An `end` the runtime added - the plan drained without one. */
    implicit?: true;
  }


  interface Wait {
    id: string;
    /** Key of the step which opened the wait. */
    step: string;
    /** Arguments of the step which opened the wait. */
    args: unknown[];
    /** Keys of the steps which may answer it. */
    answers: string[];
    /** When a duration wait closes, in epoch milliseconds. */
    until?: number;
  }

  /** A `then.on` handler: a function, given the error, or nothing on cancellation; or for a durable run, a step method uncalled - given the same - or steps called for it. */
  type Handler = { handler(reason?: unknown): unknown }['handler'] | Promise<void> | readonly Promise<void>[];

  /** Handlers for the outcomes of a step's subtree - `this.then.on({ ... })`. */
  interface On {
    /** The step is taken back - a failure leaving its subtree, `abort()`, a lost race: reset its effects. Fields are restored after it. */
    reset?: Handler;
    /**
     * A failure below, no `.catch` closer to it took it - for recovery. Returning recovers - the failed part
     * of the subtree unwinds, the step's own effects stay, steps it schedules replace the rest; throwing
     * passes it on.
     */
    catch?: Handler;
    /**
     * The subtree ended without completing, before `reset` - given the error of a failure no `catch`
     * recovered; nothing for a cancellation (`abort()`, `stop()`, a lost race). `then.status` tells which.
     */
    abort?: Handler;
    /** The subtree ended, any way - a finally over it, last. */
    close?: Handler;
  }

  /** Why a run or subtree ended: `abort()`, or a lost race. */
  type Aborted = InstanceType<typeof Steps.Aborted>;
  /** Why a run or subtree ended: `stop()`. */
  type Stopped = InstanceType<typeof Steps.Stopped>;

  interface Snapshot {
    status: Status;
    active: string | undefined;
    queue: unknown[][];
    waiting: Wait[];
    runs: number;
    error: unknown;
  }

  interface Controller<T extends Model = Model> {
    /**
     * Inside a step: park this point in the plan for a duration - units summed. The next step in
     * sequence runs once it passes.
     */
    <This>(this: This, duration: { ms?: number; sec?: number; min?: number; hr?: number; day?: number }): Promise<void>;

    /**
     * Inside a step: call `each` per item - a function issuing a step, or a step itself -
     * and run the tokens as one parallel group.
     */
    <I, This>(this: This, items: Iterable<I>, each: (item: I, index: number) => unknown): Promise<void>;

    /**
     * Inside a step: park this point in the plan until a call to one of these steps answers it - from
     * outside, or from a step called beside them (see below). The next step in sequence runs once the
     * answer, and all it schedules, is done.
     */
    <This>(this: This, ...steps: ((...args: any[]) => unknown)[]): Promise<void>;

    /**
     * Inside a step: run these tokens as one parallel group at this point in the plan.
     * The next step in sequence runs once every member, and all it schedules, is done.
     *
     * Beside steps uncalled - `this.then(this.allow, this.deny, this.timeout(call))` - each called step
     * is a racer, started when the plan reaches the wait. Once a call answers, the racers which did not
     * make it lose: signals aborted, what they scheduled dropped, gates released; a step in flight
     * settles, then each losing branch unwinds - resets run, fields restored. The winner keeps all it did.
     */
    <This>(this: This, ...steps: unknown[]): Promise<void>;

    /** The instance this controller runs. */
    readonly self: T;
    readonly status: Steps.Status;
    /** Key of a step in flight - the latest invoked, with a group in flight. */
    readonly active: string | undefined;
    /** Arguments of each `run()` waiting for the active run to finish. */
    readonly queue: readonly unknown[][];
    /** Open waits, oldest first. */
    readonly waiting: readonly Steps.Wait[];
    /** Runs finished - ended, failed, stopped or aborted. */
    readonly runs: number;
    readonly error: unknown;

    /** A plain snapshot of status, active, queue, waiting, runs and error. */
    get(): Steps.Snapshot;
    /**
     * End the run - inside a step, where the plan reaches it; from outside, now. Pending steps are
     * discarded and steps in flight settle first; `run`, awaiting the plan, then returns the result.
     */
    end(): void;
    /**
     * Inside a step: a gate at this point in the plan - queue FIFO for one of `max` slots; what this
     * step schedules after it runs holding the slot, until done. A function taking `$` - the instance's
     * tracking proxy - is re-read when anything it read through `$` changes, other Models included; one
     * taking nothing, when a slot frees and when the instance updates. `0` pauses. `key` shares the
     * queue: an object across groups and instances, any other value across this instance. Default: the
     * enclosing group's, else the instance's.
     */
    only(max: number | (($: T) => number), key?: unknown): void;
    /**
     * Halt, keeping what was done: discard pending steps and queued runs; in-flight steps settle and
     * commit. `reason` - the `cause` of the `'Stopped'` error the run and queue reject with, and its
     * message when a string.
     */
    stop(reason?: unknown): void;
    /**
     * Halt and unwind, as a failure would - status `'aborted'`; the run's resets run, newest first, and
     * fields are restored. The run and queue reject with a `Steps.Aborted`, `reason` as for `stop`.
     * A reset which throws fails the run: its error, given the `Steps.Aborted` as `cause`.
     */
    abort(reason?: unknown): void;
    /** Inside a step: a point of no return - the step is not caught, restored or undone, and the unwind stops here. */
    commit(): void;
    /** Inside a step: handlers for the outcomes of this step and all it schedules, deepest step first. */
    on(handlers: Steps.On): void;
    /** Inside a `.catch` handler: restore the caught branch's fields now; writes after it stand. */
    restore(): void;
    /**
     * Inside a step: its `AbortSignal` - aborted on `stop()` or `abort()`, an outside `end`, a failure
     * elsewhere, a race lost, and once the step settles. A step rejecting with its reason is not a failure.
     */
    readonly signal: AbortSignal;
    /** Inside a step: how many times `then.retry()` replayed it - 0 on a first run. In a handler, the failed one's. */
    readonly retried: number;
    /**
     * Inside a `.catch` handler: schedule what the catch is attached to again - the failed step, or the
     * whole group - with its recorded args, still caught by the same handler. The handler holds the policy:
     * `if (this.then.retried >= 3) throw error; this.then.retry();`. Backoff belongs in the retried step.
     */
    retry(): void;
  }

  interface Thenable<T extends Model = Model> {
    /** Idle, calls `run()` - rejecting if it takes arguments; then settles once the active run and every queued one have, with the last one's result. */
    <R1 = Steps.Result<T>, R2 = never>(
      onfulfilled?: ((value: Steps.Result<T>) => R1 | PromiseLike<R1>) | null,
      onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
    ): Promise<R1 | R2>;

    then: Steps.Runner<T>;
  }

  /**
   * The controller, and a thenable - so the instance with it as `then`. Awaiting it joins the
   * active run; idle, it calls `run()`, or rejects if `run` takes arguments.
   */
  type Runner<T extends Model = Model> = Controller<T> & Thenable<T>;
}

function install<T extends Steps>(self: T) {
  const runner = function (onfulfilled?: unknown, onrejected?: unknown) {
    if (onfulfilled && typeof onfulfilled == 'object') throw rule('then(steps) must be called inside a step.');

    return control.settled().then(onfulfilled as any, onrejected as any);
  } as Steps.Runner<T>;

  const control = Control.new({ _self: self, _runner: runner });

  const read: Record<(typeof KEYS)[number], () => unknown> = {
    status: () => control.status,
    active: () => control.active,
    queue: () => control.queue.map((ticket) => ticket.args),
    waiting: () => control.run.waits.map(({ id, step, args, answers, until }) => ({ id, step, args, answers, ...until !== undefined && { until } })),
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
    self: { value: self },
    get: { value: () => Object.fromEntries(KEYS.map((key) => [key, read[key]()])) },
    end: { value: (...value: unknown[]) => void (valueless(value), control.conclude()) },
    stop: { value: (reason?: unknown) => control.stop(false, reason) },
    abort: { value: (reason?: unknown) => control.stop(true, reason) },
    only: { value: () => outside('only') },
    commit: { value: () => outside('commit') },
    on: { value: () => outside('on') },
    restore: { value: () => outside('restore') },
    signal: { get: () => outside('signal', 'read') },
    retry: { value: () => outside('retry') },
    retried: { get: () => outside('retried', 'read') }
  });

  event(runner);

  Object.defineProperty(self, 'then', {
    configurable: true,
    get(this: object) {
      const view = touch(this, 'then', runner);

      return view === runner ? runner : Object.setPrototypeOf((...args: [any?, any?]) => runner(...args), view);
    }
  });

  const { _hooks: hooks, _steps: steps } = control;

  const wire = () => {
    for (const key of steps.keys()) delete (self as any)[key];

    steps.clear();
    hooks.clear();

    for (let proto = Object.getPrototypeOf(self); proto !== Model.prototype; proto = Object.getPrototypeOf(proto))
      for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
        let method = desc.get && unbind(desc.get) !== desc.get;
        let skip = !method || key == 'new' || key[0] == '_' || Object.hasOwn(self, key);

        if (skip) continue;

        if (key == 'end') throw rule(`${self.constructor.name} declares end; return the result from run, end early with this.then.end().`);
        if (RESERVED.includes(key)) throw rule(`${self.constructor.name} declares ${key}; then, end, gate and wait name plan tokens - rename the step.`);

        if (HOOKS.has(key)) {
          if (!hooks.has(key)) hooks.set(key, unbind(desc.get!));
          continue;
        }

        const step = (...args: unknown[]) => control.call(key, args);

        steps.set(key, unbind(desc.get!));
        Object.defineProperty(
          self,
          key,
          key == 'run'
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
  };

  wire();
  listener(self, (key) => void (key === REFRESH && wire()));

  self.get(null, () => control.stop());
}

/**
 * A runnable Model: its methods are steps, `run()` starts a run and awaiting the instance joins
 * it, resolving with what `run` returns. The members below are the contract - each optional.
 */
class Aborted extends Error {
  override name = 'Aborted';
}

class Stopped extends Error {
  override name = 'Stopped';
}

class Steps extends Model {
  /** Why a run or subtree ended: `abort()`, or a lost race. */
  static readonly Aborted = Aborted;
  /** Why a run or subtree ended: `stop()`. */
  static readonly Stopped = Stopped;

  /** The controller - status, journal, queue, waits; awaiting the instance awaits it. */
  declare readonly then: Steps.Runner<this>;

  constructor(...args: Model.Args) {
    super(...args);
    install(this);
  }

  /**
   * The entry, `async`: starts a run, or queues one while a run is active. Its return is the run's result.
   * It takes arguments and calls steps; `await this` inside it waits for the run, then it returns.
   */
  run?(...args: any[]): Promise<unknown>;

  /** Before each step, once per step. */
  protected before?(step: string, args: unknown[]): void;

  /** After each step commits, once per step. */
  protected after?(step: string, entry: Steps.Entry): void;
}

class Control extends Model {
  status: Steps.Status = 'idle';
  active: string | undefined = undefined;
  runs = 0;
  error: unknown = undefined;
  queue = has<Ticket>();
  run = new Run();

  _self!: Model;
  _runner!: object;
  _steps = new Map<string, Function>();
  _hooks = new Map<string, Function>();
  _gates = new Map<unknown, Gate>();
  _current?: Run = undefined;

  protected new() {
    const { _runner } = this;

    listener(this.queue, (key) => {
      if (signal(key)) event(this, 'queue');
    });

    return this.set((key) => void event(_runner, key as string));
  }

  call(key: string, args: unknown[]) {
    if (key == 'run') return this.start(args);

    const { _current: current } = this;
    const wait = current && current.route(key, args);

    if (wait) return current!.wake(wait, key, args);

    throw rule(`${key} cannot be called from outside; call run() to start a run.`);
  }

  accepts(key: string) {
    return !!this._current?.accepts(key);
  }

  hook(key: string, ...args: unknown[]) {
    return this._hooks.get(key)?.apply(this._self, args);
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

    return handle(ticket, (resolve, reject) => ticket.promise.then(resolve, reject));
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
      if (this._steps.get('run')?.length)
        return Promise.reject(new Error(`${this._self} is idle. run() takes arguments; call it to start a run.`));

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

  conclude() {
    const { _current: run } = this;

    if (run && !run.stale()) run.terminate(run.node('end', []));
  }

  stop(undo?: boolean, reason?: unknown) {
    const { _current: current, queue } = this;

    if (!current) return;

    const message = typeof reason == 'string' ? reason : `${this._self} was ${undo ? 'aborted' : 'stopped'}.`;
    const stopped = new (undo ? Aborted : Stopped)(message, reason === undefined ? undefined : { cause: reason });

    for (const ticket of queue) ticket.reject(stopped);

    queue.clear();

    current._stopped = stopped;
    current.release();
    current.halt(undo ? 'aborted' : 'stopped');
  }
}

class Run extends Model {
  control = get(Control);
  frames = has(Frame);
  waits = has(Wait);

  _ticket!: Ticket;
  _entries: Steps.Entry[] = [];
  _counts = new Map<string, number>();
  _on = new Map<string, Handler[]>();
  _finished = new Set<string>();
  _reset = new Set<string>();
  _writer = new Map<string, string>();
  _lost = new Set<string>();
  _losing = new Map<string, Promise<unknown>>();
  _held = new Map<string, Held>();
  _inline = new Map<string, Function>();
  _plain = new Set<string>();
  _errors = new Map<string, unknown>();
  _owner = new Map<string, Frame>();
  _parent = new Map<string, string>();
  _slots = new Map<string, Slot>();
  _catches = new Map<string, Rescue>();
  _branches = new Map<string, Branch>();
  _lineage = new Map<string, Lineage>();
  _retried = new Map<string, number>();
  _gates = new Map<string, Gate>();
  _groups = new Set<string>();
  _pending = new Map<string, () => void>();
  _holding = new Map<() => void, string>();
  _dropped = new Set<string>();
  _spent = new Set<string>();
  _unwinding?: Promise<unknown> = undefined;
  _drained: (() => void)[] = [];
  _quiet = new Set<() => void>();
  _halted?: 'failed' | 'stopped' | 'aborted' = undefined;
  _ending?: boolean = undefined;
  _settling?: boolean = undefined;
  _error?: unknown = undefined;
  _stopped?: Error = undefined;
  _root?: string = undefined;
  _result?: unknown = undefined;
  _tail?: Promise<unknown> = undefined;
  _await?: { resolve(value?: unknown): void; reject(error: unknown): void } = undefined;

  protected new() {
    const { control } = this;

    listener(this.waits, (key) => {
      let current = signal(key) && control._current === this;

      if (!current) return;

      event(control, 'waiting');

      control.status = this.waits.size ? 'waiting' : this._halted || 'running';
    });
  }

  start() {
    const node = this.node('run', this._ticket.args);

    this._root = node.id;
    this.exec(node).then(() => {
      if (!this._halted && !this._ending) this.end();
    });
  }

  node(key: string, args: unknown[]): Steps.Node {
    const count = (this._counts.get(key) || 0) + 1;

    this._counts.set(key, count);

    return Object.assign(Object.create(TOKEN), { id: `${key}#${count}`, key, args }) as Steps.Node;
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
    return this.line(id).some((at) => this._dropped.has(at) || (at !== id && this._dropped.has(at + '^')));
  }

  line(id: string) {
    const ids: string[] = [];

    for (let at: string | undefined = id; at; at = this._parent.get(at)) ids.push(at);

    return ids;
  }

  async exec(item: Steps.Node, from?: Frame): Promise<void> {
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
        const frame = await answer.frame;

        await this.cover(frame);
        await this.complete(frame);
        answer.done();
      }
    }
    else if (item.key == 'end') await this.terminate(item);
    else {
      const wait = this.racing(item);

      if (wait) return void this.wake(wait, item.key, item.args, item);

      const frame = await this.invoke(item);

      await this.cover(frame, item);
      await this.complete(frame);
    }
  }

  async cover(frame?: Frame, item?: Steps.Node) {
    const handler = frame && this._on.get(frame.id)?.find(({ kind }) => kind == 'catch');

    if (!handler) return this.descend(frame);

    const { id, key, args, _failed: failed } = frame!;
    const shield = id + '^';
    const branch: Branch = { failed };

    item ||= Object.assign(Object.create(TOKEN), { id, key, args });

    if (!failed) {
      this._branches.set(shield, branch);
      await this.descend(frame);
      this._branches.delete(shield);
    }

    if (!branch.failed) return;

    const { cause } = branch.failed;
    const restore = await this.serial(() => (failed ? this.rewind(id, cause) : this.recover(item!, cause, 'error', false)));

    this._dropped.delete(shield);

    if (this.stale()) return restore();

    const node = this.given(handler, cause);

    this._parent.set(node.id, id);
    this._lineage.set(node.id, { restore, caught: item! });
    this._retried.set(node.id, this.retried(item!));

    await this.exec(node, frame);
    restore();
  }

  async rewind(id: string, cause: unknown): Promise<Restore> {
    const entry = this._entries.find((each) => each.id == id)!;
    const { prior, log } = this._held.get(id)!;
    const kept = new Set<string>();

    this._reset.add(id);
    this._held.delete(id);

    try {
      await this.fire(this._on.get(id), 'reset', undefined, kept);
      entry.unwound = true;
    } catch (thrown) {
      entry.unwound = 'failed';
      this.halt('failed', thrown);
    }

    const self = this.control._self as any;
    let done = false;

    return (into, all) => {
      if (done) return;

      done = true;

      for (const key in prior) {
        const wrote = into?._wrote.has(key);

        if (wrote) into!._prior[key] = prior[key];
        if (all || (!wrote && !kept.has(key))) self[key] = prior[key];
      }

      for (const [key, undo] of [...log].reverse()) if (all || !into?._changed.has(key)) undo();
    };
  }

  async complete(frame?: Frame) {
    const on = frame && this._on.get(frame.id);

    if (!on) return;

    const { id } = frame!;
    const losing = [...this._losing].filter(([racer]) => this.line(racer).includes(id));

    await Promise.all(losing.map(([, unwind]) => unwind));

    if (this.stale() || this.dropped(id)) return;

    this._finished.add(id);

    try {
      await this.fire(on, 'close', undefined, new Set());
    } catch (error) {
      if (!this.caught(error, id)) this.halt('failed', error);
    }
  }

  async fire(on: Handler[] | undefined, kind: Kind, cause: unknown, kept: Set<string>) {
    for (const handler of [...(on || [])].reverse())
      if (handler.kind == kind) await this.compensate(this.given(handler, cause), cause, kept, kind == 'reset' || kind == 'close' || cause === undefined);
  }

  given({ node, bare, kind }: Handler, cause: unknown) {
    if (bare && (kind == 'catch' || (kind == 'abort' && cause !== undefined))) {
      node.args = [serial(cause)];
      this._errors.set(node.id, cause);
    }
    else if (kind == 'catch' && this._inline.has(node.id)) node.args = [cause];

    return node;
  }

  racing(item: Steps.Node) {
    const line = this.line(item.id);

    return this.waits.filter((wait) => !!wait._race && line.includes(wait.id) && wait.answers.includes(item.key))[0];
  }

  lose(wait: Wait, won: string[], answer: Steps.Node) {
    const race = wait._race!;
    const losers = (race.group || [race]).filter((racer) => !won.includes(racer.id));
    const cause = new Aborted(`${answer.key} answered ${wait.id}.`);

    for (const racer of losers) {
      this._dropped.add(racer.id);
      this._lost.add(racer.id);
    }

    for (const frame of this.discard()) frame._abort.abort(cause);
    for (const [release, from] of this._holding) if (this.dropped(from)) release();

    for (const racer of losers)
      this._losing.set(
        racer.id,
        this.serial(async () => {
          await this.quiet(racer.id);
          (await this.recover(racer, cause, 'abort'))(undefined, false, racer.id);
        })
      );
  }

  quiet(id: string) {
    const busy = () => this.flight().some((frame) => this.line(frame.id).includes(id));

    return new Promise<void>((resolve) => {
      const check = () => {
        if (busy()) return;

        this._quiet.delete(check);
        resolve();
      };

      this._quiet.add(check);
      check();
    });
  }

  terminate(item: Steps.Node) {
    this.release();

    for (const frame of this.flight()) frame._abort.abort();

    return this.end(item);
  }

  serial<T>(task: () => Promise<T>) {
    const prior = this._unwinding;
    const next = (async () => {
      await prior;
      return task();
    })();

    this._unwinding = next;

    return next;
  }

  async guard(item: Steps.Node, from: Frame, rescue: Rescue) {
    const branch: Branch = {};

    this._branches.set(item.id, branch);

    await this.exec(item, from);

    this._branches.delete(item.id);

    if (!branch.failed) return;

    const { cause } = branch.failed;
    const restore = await this.serial(() => this.recover(item, cause, 'error'));
    const { key, fn } = rescue;
    const parent = this._parent.get(item.id)!;

    if (this.stale() || !fn) return restore();

    const node = this.node(key || 'then', key ? [serial(cause)] : [cause]);

    if (key) this._errors.set(node.id, cause);

    this._parent.set(node.id, parent);
    this._lineage.set(node.id, { restore, caught: item });
    this._retried.set(node.id, this.retried(item));

    if (!key) {
      this._inline.set(node.id, fn!);
      this._owner.set(node.id, from);
    }

    await this.exec(node, from);
    restore();
  }

  retried(item: Steps.Node) {
    return this._retried.get(item.id) || 0;
  }

  copy(item: Steps.Node, retried = this.retried(item) + 1): Steps.Node {
    const { id, key, args, group, answers, race } = item;
    const node = this.node(key, args);
    const rescue = this._catches.get(id);

    this._retried.set(node.id, retried);

    if (group) {
      node.group = group.map((member) => this.copy(member, retried));
      this._groups.add(node.id);
      adopt(this._parent, node.group, node.id);
    }

    if (answers) node.answers = answers;

    if (race) {
      node.race = this.copy(race, retried);
      adopt(this._parent, [node.race], node.id);
    }

    if (rescue) {
      node.rescue = item.rescue;
      this._catches.set(node.id, rescue);
    }

    return node;
  }

  async recover(item: Steps.Node, cause: unknown, mode: Mode, own = true): Promise<Restore> {
    const ids = this._entries.filter((entry) => !this._spent.has(entry.id) && (own || entry.id != item.id) && this.line(entry.id).includes(item.id));
    const unwound = await this.unwind(cause, mode, new Set(ids.map((entry) => entry.id)));
    let done = false;

    const restore: Restore = (into, all, within) => {
      if (done) return;

      done = true;
      this.refill(unwound, into, all, within);
    };

    if (unwound.failed) {
      const { cause: thrown } = unwound.failed;

      restore();

      if (mode == 'abort') chain(thrown, cause);

      this.halt('failed', thrown);
    }

    return restore;
  }

  caught(error: unknown, id: string) {
    if (this.stale() || RULES.has(error as Error)) return false;

    let at: string | undefined;

    for (const each of this.line(id))
      if (each != id && this._branches.has((at = each + '^'))) break;
      else if (this._branches.has((at = each))) break;
      else at = undefined;

    if (!at) return false;

    const branch = this._branches.get(at)!;

    if (branch.failed) return true;

    branch.failed = { cause: error };
    this._dropped.add(at);

    for (const frame of this.discard()) frame._abort.abort();

    return true;
  }

  discard() {
    for (const wait of this.waits.filter((wait) => this.dropped(wait.id))) this.waits.delete(wait);
    for (const [id, cancel] of this._pending) if (this.dropped(id)) cancel();

    return this.flight().filter((frame) => this.dropped(frame.id));
  }

  async descend(frame?: Frame) {
    if (frame) await this.sequence(frame._items, frame);
  }

  async sequence(items: Steps.Node[], from: Frame): Promise<void> {
    for (const [index, item] of items.entries()) {
      if (item.key != 'gate') {
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

  acquire(item: Steps.Node, from: Frame) {
    if (this.stale() || this.dropped(item.id)) return;

    const { id } = item;
    const { max, key } = this._slots.get(id)!;
    const gate = this.gate(from, key);
    const line = this.line(from.id);
    const hold: Hold = { run: this, from: from.id };
    const inside = [...gate.held].some((each) => each.run === this && line.includes(each.from));
    const self = this.control._self;

    return new Promise<(() => void) | undefined>((resolve) => {
      let quiet: (() => void) | undefined;
      let limit = 0;
      let over = false;

      const finish = (release?: () => void) => {
        over = true;
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

      if (inside) return finish(() => {});

      this._pending.set(id, () => {
        gate.queue = gate.queue.filter((each) => each !== waiter);
        finish();
      });

      if (typeof max == 'function')
        quiet = max.length
          ? watch(self, ($) => {
              limit = max($);
              pump(gate);

              return over ? null : undefined;
            })
          : listener(self, (key) => void (signal(key) && pump(gate)));

      gate.queue.push(waiter);
      pump(gate);
    });
  }

  gate(from: Frame, key: unknown) {
    const { control } = this;

    if (key instanceof Object) return gate(GATES, key);
    if (key !== undefined) return gate(control._gates, key);

    const group = this.line(from.id).find((id) => this._groups.has(id));

    return group ? gate(this._gates, group) : gate(control._gates, control);
  }

  park(item: Steps.Node, from: Frame) {
    return new Promise<Answer | undefined>((resolve) => {
      const { id, answers, race, args } = item;
      const until = answers!.length ? undefined : Date.now() + (args[0] as number);

      this.waits.add({ id, step: from.key, args: from.args, answers, until, _race: race, _from: from, _park: resolve });

      if (race) void this.exec(race, from);
    });
  }

  wake(wait: Wait, key: string, args: unknown[], node = this.node(key, args)) {
    const { _ticket } = this;
    let done!: () => void;
    let fail!: (error: unknown) => void;

    const answered = handle<void>(_ticket, (res, rej) => {
      done = res;
      fail = rej;
    });

    const answer = { done: () => (this._halted ? fail(this.reason()) : done()), fail } as Answer;
    const won = this.line(node.id);

    wait._answer = answer;
    this._parent.set(node.id, wait.id);
    this.waits.delete(wait);

    if (wait._race) this.lose(wait, won, node);

    answer.frame = this.invoke(node, wait.id);

    return answered;
  }

  release() {
    this.waits.clear();

    for (const cancel of this._pending.values()) cancel();
    for (const release of this._holding.keys()) release();
  }

  async invoke(node: Steps.Node, wake?: string, undo?: boolean): Promise<Frame | undefined> {
    const { control } = this;
    const { id, key, args } = node;
    const inline = this._inline.get(id);
    const lineage = this._lineage.get(id);
    const fn = inline || control._steps.get(key)!;
    const frame = this.frames.add({ id, key, args, _wake: wake, _undo: undo, _owner: this._owner.get(id), _retried: this.retried(node), ...lineage && { _restore: lineage.restore, _caught: lineage.caught } });
    const input = this._errors.has(id) ? [this._errors.get(id)] : args;
    let body = false;

    control.active = key;

    try {
      control.hook('before', key, args);

      if (!fn) throw rule(key == 'run' ? `${control._self} declares no run - add async run() to start a run.` : `${key} was removed by a hot update.`);

      for (;;)
        try {
          const call = this._plain.has(id) ? fn(...input) : fn.apply(frame._proxy, input);
          const out = id == this._root ? await frame.open(call) : await call;

          frame._settled = true;

          const entry = frame.commit(out);

          frame._restore?.(frame);
          control.hook('after', key, entry);

          return frame;
        } catch (thrown) {
          if (frame._entry) throw thrown;

          let error = thrown;
          let irreversible = [...frame._lost];
          let fixed = irreversible.length || frame._committed;

          body = !frame._settled;

          if (error instanceof Promise && body && !fixed) {
            await this.fire(frame._on, 'reset', undefined, new Set());

            this.reset(frame);

            const failed = await frame.pause(error);

            if (!failed) continue;

            error = failed.cause;
          }

          if (fixed) this._entries.push({ ...frame.journal(), error, ...irreversible.length && { irreversible } });

          throw error;
        }
    } catch (error) {
      if (frame._entry && !undo) {
        frame._restore?.();
        return void this.halt('failed', error);
      }

      const { signal } = frame._abort;
      const fixed = frame._lost.size || frame._committed;
      const lost = this.line(id).some((at) => this._lost.has(at));
      const aborted = signal.aborted && error === signal.reason;
      const on = !fixed && !undo && frame._on.length ? frame._on : undefined;
      const defer = on && !aborted && !this.stale();
      const entry: Steps.Entry = { id, key, args, next: [], wrote: [], error, ...wake && { wake }, ...frame._retried && { retried: frame._retried } };

      frame._settled = true;

      if (!fixed && !defer) this.restore(frame._prior, frame._log);

      frame._restore?.();

      if (undo) throw error;

      if (on) {
        entry.on = grouped(on);
        this._on.set(id, on);
        this._entries.push(entry);
      }

      if (defer) this._held.set(id, { prior: frame._prior, log: frame._log });
      if (aborted) return;

      let own = body && !fixed && !lost && !this.stale() && !RULES.has(error as Error) && !!on?.some(({ kind }) => kind == 'catch');

      if (own) {
        frame._failed = { cause: error };

        try {
          control.hook('after', key, entry);
        } catch (thrown) {
          this.halt('failed', thrown);
        }

        return frame;
      }

      if (body && !fixed && (lost || this.caught(error, id))) {
        if (!on) this._entries.push(entry);

        try {
          control.hook('after', key, entry);
        } catch (thrown) {
          this.halt('failed', thrown);
        }
      } else this.fault(frame, entry, !on, error);
    } finally {
      this.frames.delete(frame);
      control.active = this.flight().at(-1)?.key;

      for (const check of [...this._quiet]) check();

      if (!this.flight().length) for (const resolve of this._drained.splice(0)) resolve();
    }
  }

  fault(frame: Frame, entry: Steps.Entry, push: boolean, error: unknown) {
    if (frame._caught) {
      if (push) this._entries.push(entry);

      try {
        this.control.hook('after', entry.key, entry);
      } catch (thrown) {
        error = thrown;
      }
    }

    this.halt('failed', error);
  }

  reset(frame: Frame) {
    this.restore(frame._prior, frame._log);
    frame._armed++;

    Object.assign(frame, {
      _wrappers: new Map(),
      _log: [],
      _changed: new Set(),
      _items: [],
      _wrote: new Set(),
      _prior: {},
      _on: [],
      _violation: undefined,
      _late: undefined
    });
  }

  async end(item?: Steps.Node) {
    this._ending = true;

    await this.drain();

    if (this._unwinding) await this._unwinding;
    if (this._halted) return;

    const open = this._entries.filter((entry) => this._on.has(entry.id) && !this._finished.has(entry.id) && !this._spent.has(entry.id));

    for (const entry of open.reverse())
      try {
        this._finished.add(entry.id);
        await this.fire(this._on.get(entry.id), 'close', undefined, new Set());
      } catch (thrown) {
        return this.halt('failed', thrown);
      }

    const { id } = item || this.node('end', []);
    const entry = { id, key: 'end', args: [], next: [], wrote: [], ...!item && { implicit: true as const } };

    this._entries.push(entry);

    if (item)
      try {
        this.control.hook('after', 'end', entry);
      } catch (thrown) {
        return this.halt('failed', thrown);
      }

    this.finish();
  }

  drain() {
    if (this.flight().length) return new Promise<void>((resolve) => this._drained.push(resolve));
  }

  finish() {
    const { _tail: tail } = this;

    this._settling = true;

    if (!tail) return this.settle(this._result);

    this._await!.resolve();
    tail.then((value) => this.settle(value), (error) => this.broke(error));
  }

  broke(error: unknown) {
    this.blame(error);
    this.control.status = 'failed';
    this.reject();
  }

  settle(value: unknown) {
    const { control } = this;

    this.close();
    control.status = 'idle';
    this._ticket.resolve(value);
    control.advance();
  }

  close() {
    const { control } = this;

    control._current = undefined;
    control.runs++;
    this._entries = [];
    this._held.clear();
    this._on.clear();
    this.frames.clear();
    this.waits.clear();
  }

  halt(status: 'failed' | 'stopped' | 'aborted', error?: unknown) {
    const { control } = this;

    if (this._halted || this._settling) return;

    this._halted = status;
    control.status = status;

    for (const frame of this.flight()) frame._abort.abort(status == 'failed' ? undefined : this._stopped);

    if (status == 'failed') {
      this._error = error;
      control.error = error;
    }

    this.release();
    this.finalize(MODES[status]);
  }

  async finalize(mode: Mode) {
    await this.drain();

    if (this._unwinding) await this._unwinding;

    const unwound = await this.unwind(this.reason(), mode);

    this.refill(unwound);

    if (unwound.failed) {
      const { cause } = unwound.failed;

      if (mode != 'error') {
        chain(cause, this._stopped);
        this.control.status = 'failed';
      }

      this.blame(cause);
    }

    const { _tail: tail } = this;

    if (!tail) return this.reject();

    this._await!.reject(this.reason());

    try {
      this.salvage(await tail);
    } catch (thrown) {
      this.reject(thrown);
    }
  }

  salvage(value: unknown) {
    this.close();
    this._ticket.resolve(value);
    this.control.advance();
  }

  reason() {
    const { _error: error } = this;

    return error === undefined ? this._stopped : error;
  }

  reject(reason = this.reason()) {
    const { _ticket } = this;
    let stopped = reason === this._stopped;

    this.close();
    _ticket.reject(reason);

    if (!stopped)
      queueMicrotask(() => queueMicrotask(() => {
        if (!_ticket.awaited) throw reason;
      }));

    this.control.advance();
  }

  async unwind(cause: unknown, mode: Mode, ids?: Set<string>): Promise<Unwound> {
    const { control, _entries: entries } = this;
    const pending = entries.filter((entry) => (ids ? ids.has(entry.id) : !this._spent.has(entry.id)));
    const kept = new Set<string>();
    const undone: Steps.Entry[] = [];
    let halted = mode == 'stop';

    for (const entry of pending.reverse()) {
      const on = this._on.get(entry.id);
      const open = !this._finished.has(entry.id);

      if (ids && this._halted) break;
      if (entry.unwound == 'failed') break;

      if (!halted && (entry.irreversible || entry.committed)) {
        entry.halted = halted = true;

        if (entry.irreversible)
          console.warn(`${control._self} stopped unwinding at ${entry.id}: ${entry.irreversible.join(', ')} cannot be restored.`);
      }

      if (!on && 'error' in entry) continue;

      try {
        if (open) await this.fire(on, 'abort', mode == 'error' ? cause : undefined, kept);
        if (!halted && !this._reset.has(entry.id)) await this.fire(on, 'reset', undefined, kept);

        this._finished.add(entry.id);

        if (open) await this.fire(on, 'close', undefined, kept);
      } catch (thrown) {
        entry.unwound = 'failed';
        return { undone, kept, failed: { cause: thrown } };
      }

      this._spent.add(entry.id);

      if (halted) continue;
      if (on?.some((handler) => handler.kind == 'reset') || (this._held.has(entry.id) && entry.wrote.length)) entry.unwound = true;

      undone.push(entry);
    }

    return { undone, kept };
  }

  async compensate(item: Steps.Node, cause: unknown, kept: Set<string>, bare?: boolean) {
    const fn = this._inline.get(item.id);

    if (!fn) return this.undo([item], kept);

    const frame = this.frames.add({ id: item.id, key: item.key, args: item.args, _undo: true, _owner: this._owner.get(item.id) });
    try {
      await (bare ? fn() : fn(cause));
    } finally {
      this.frames.delete(frame);
      for (const key of frame._wrote) kept.add(key);
    }

    await this.undo(frame._items, kept);
  }

  async undo(items: Steps.Node[], kept: Set<string>): Promise<void> {
    for (const item of items)
      if (item.group) await Promise.all(item.group.map((member) => this.undo([member], kept)));
      else {
        const frame = (await this.invoke(item, undefined, true))!;

        for (const key of frame._wrote) kept.add(key);

        await this.undo(frame._items, kept);
      }
  }

  refill({ undone, kept }: Unwound, into?: Frame, all?: boolean, within?: string) {
    const self = this.control._self as any;
    const prior = new Map<string, unknown>();
    const log: Log = [];

    for (const entry of undone) {
      const held = this._held.get(entry.id);

      if (!held) continue;

      for (const key in held.prior) prior.set(key, held.prior[key]);

      log.push(...[...held.log].reverse());
    }

    const since = (key: string) => !!within && !this.line(this._writer.get(key)!).includes(within);

    for (const [key, value] of prior) {
      const wrote = into?._wrote.has(key);

      if (wrote) into!._prior[key] = value;
      if (all || (!wrote && !kept.has(key) && !since(key))) self[key] = value;
    }

    for (const [key, undo] of log) if (all || (!into?._changed.has(key) && !since(key))) undo();
  }

  blame(cause: unknown) {
    this._error = cause;
    this.control.error = cause;
  }

  restore(prior: Record<string, unknown>, log: Log) {
    const self = this.control._self as any;

    for (const key in prior) self[key] = prior[key];
    for (const [, undo] of [...log].reverse()) undo();
  }
}

class Frame extends Model {
  run = get(Run);
  id = '';
  key = '';
  args: unknown[] = [];

  _proxy!: Model;
  _owner?: Frame = undefined;
  _view?: Steps.Controller = undefined;
  _refs = new Map<string, Function>();
  _abort = new AbortController();
  _items: Steps.Node[] = [];
  _wrote = new Set<string>();
  _prior: Record<string, unknown> = {};
  _wrappers = new Map<Collection, Collection>();
  _log: Log = [];
  _on: Handler[] = [];
  _changed = new Set<string>();
  _lost = new Set<string>();
  _wake?: string = undefined;
  _undo?: boolean = undefined;
  _retried = 0;
  _restore?: Restore = undefined;
  _caught?: Steps.Node = undefined;
  _failed?: { cause: unknown } = undefined;
  _committed?: boolean = undefined;
  _entry?: Steps.Entry = undefined;
  _violation?: string = undefined;
  _late?: boolean = undefined;
  _armed = 0;
  _settled?: boolean = undefined;
  _point?: (done: (value?: unknown) => void, fail: (error: unknown) => void) => void = undefined;

  protected new() {
    const { _self: self, _steps, _runner } = this.run.control;

    this._proxy = new Proxy(self, {
      get: (target, prop) => {
        const live = this._settled && this.live();

        if (live) return Reflect.get(live._proxy, prop);
        if (_steps.has(prop as string)) return this.ref(prop as string);

        const value = Reflect.get(target, prop, target);

        if (value === _runner) return this.view();

        let managed = !this._undo && !this._settled && collection(value);

        return managed ? this.wrap(prop as string, value) : value;
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

        this.run._writer.set(key, this.id);

        return Reflect.set(target, prop, value, target);
      }
    });

    return () => this._abort.abort();
  }

  live() {
    const { run } = this;

    if (run.waits.any((wait) => wait._from === this)) return;

    const live = [...run.frames].filter((frame) => frame.within(this));

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

    if (this._undo && UNPLANNED.includes(key)) throw rule(`${named(key)} cannot run in an undo.`);
    if (this._settled) throw rule(`${this.key} has settled; ${key} cannot run.`);
    if (key == 'run') throw rule('run is the entry - loop with a step: a step which schedules itself again.');

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

    throw rule(`${this.key} has settled; ${key} cannot run.`);
  }

  async pause(pending: Promise<unknown>) {
    const { signal } = this._abort;
    const abort = new Promise((resolve) => signal.addEventListener('abort', resolve, { once: true }));
    let failed: { cause: unknown } | undefined;

    if (!signal.aborted) await Promise.race([pending, abort]).catch((cause) => (failed = { cause }));
    if (signal.aborted) throw signal.reason;

    return failed;
  }

  open(call: unknown) {
    const { run } = this;
    const body = Promise.resolve(call);

    body.catch(() => {});
    this.arm();

    return new Promise((resolve, reject) => {
      this._point = (done, fail) => {
        if (this._late) {
          const error = rule('run awaited work before its plan - it takes arguments, calls steps and awaits this.');

          fail(error);
          return reject(error);
        }

        run._await = { resolve: done, reject: fail };
        run._tail = body;
        resolve(undefined);
      };

      body.then(
        (value) => {
          if (run._tail) return;

          run._result = value;
          resolve(undefined);
        },
        (error) => {
          if (!run._tail) reject(error);
        }
      );
    });
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

  view(): Steps.Controller {
    if (this._view) return this._view;

    const retry = () => this.retry();

    RETRY.add(retry);

    const view = (...args: unknown[]) => {
      const [items, each] = args as [unknown, (item: unknown, index: number) => unknown];
      const fns = args.filter((arg) => typeof arg == 'function');
      const refs = fns.map((fn) => this.keyOf(fn)).filter(Boolean) as string[];
      const tokens = args.filter((arg) => arg && typeof arg == 'object');
      let timed = args.some(plain);
      let mapped = args.length == 2 && iterable(items) && typeof each == 'function';
      let grouped = args.length && tokens.length == args.length;
      let waits = refs.length && refs.length == fns.length && refs.length + tokens.length == args.length;

      if (timed && args.length > 1) throw rule('then() takes a duration alone - this.then({ sec: 10 }).');
      if (timed) return this.delay(items as Record<string, unknown>);
      if (mapped) return this.group(Array.from(items as Iterable<unknown>, each));
      if (grouped) return this.group(args);
      if (waits) return this.wait(refs, tokens);
      if (refs.length) throw rule('then() takes steps uncalled to answer and called ones to race - not other functions.');
      if (fns.length == 2 && args.length == 2 && this._point && !this._settled) return this._point(fns[0] as any, fns[1] as any);
      if (fns.length == 1) throw rule('then() takes steps, not a function - declare the work as a step.');

      throw rule('a step cannot await its own run.');
    };

    Object.setPrototypeOf(view, this.run.control._runner);
    Object.defineProperties(view, {
      then: { value: view },
      end: { value: (...value: unknown[]) => (valueless(value), this.issue('end', [])) },
      signal: { get: () => this._abort.signal },
      retried: { get: () => this._retried },
      retry: { value: retry },
      only: { value: (max: unknown, key?: unknown) => this.slot(max, key) },
      on: { value: (handlers: unknown) => this.handle(handlers) },
      restore: {
        value: () => {
          if (!this._restore) throw rule('restore() must be called in a .catch handler.');

          this._restore(this, true);
        }
      },
      commit: {
        value: () => {
          if (this._settled) throw rule(`${this.key} has settled; commit cannot run.`);

          this._committed = true;
        }
      }
    });

    return (this._view = view as unknown as Steps.Controller);
  }

  handle(handlers: unknown) {
    const { run } = this;
    const usage = 'then.on() takes steps called for it - { reset: this.release(id) } - or a function.';

    if (this.id == run._root) throw rule('run cleans up in its tail - try/catch around await this.');
    if (this._settled) throw rule(`${this.key} has settled; on cannot run.`);
    if (!plain(handlers)) throw rule(usage);

    for (const [kind, value] of Object.entries(handlers as object)) {
      if (!KINDS.includes(kind as Kind)) throw rule(`then.on() takes reset, catch, abort and close - got ${kind}.`);
      if (value === undefined) continue;
      if (kind == 'catch' && this._on.some((handler) => handler.kind == 'catch')) throw rule('then.on() takes one catch per step.');

      const step = typeof value == 'function' && this.keyOf(value);
      let node: Steps.Node;

      if (step) node = run.node(step, []);
      else if (typeof value == 'function') {
        node = run.node('then', []);
        run._inline.set(node.id, value);
        run._owner.set(node.id, this);
        run._plain.add(node.id);
      }
      else [node] = this.claimed(Array.isArray(value) ? value : [value], usage, 'then.on()');

      this._on.push({ kind: kind as Kind, node, bare: !!step });
    }
  }

  claimed(args: unknown[], usage: string, verb = 'then()') {
    const { _steps } = this.run.control;
    const fns = args.filter((arg) => typeof arg == 'function');
    const steps = args.every((arg) => {
      const node = arg as Steps.Node;

      return this._items.includes(node) && !UNPLANNED.includes(node.key) && (node.group || _steps.has(node.key));
    });

    if (fns.length && fns.length < args.length) throw rule(`${verb} takes called steps or step references, not both.`);
    if (!args.length || !steps) throw rule(usage);

    return this.claim([args.length > 1 ? this.group(args) : (args[0] as Steps.Node)]);
  }

  claim(nodes: Steps.Node[]) {
    this._items = this._items.filter((item) => !nodes.includes(item));

    if (this._items.length) this.arm();
    else {
      this._armed++;
      this._late = undefined;
    }

    return nodes;
  }

  rescue(token: Steps.Node, handler: unknown) {
    const key = this.keyOf(handler);

    if (UNCAUGHT.includes(token.key)) throw rule(`${named(token.key)} cannot be caught.`);
    if (handler && typeof handler != 'function') throw rule('catch() takes a step, a function or nothing.');
    if (RETRY.has(handler as Function))
      throw rule('catch() retries from a handler: .catch(this.rescan), rescan(error) { if (this.then.retried >= 3) throw error; this.then.retry(); }');

    token.rescue = handler ? key || 'then' : true;
    this.run._catches.set(token.id, { key, fn: handler as Function | undefined });

    return token;
  }

  retry() {
    const { run, _caught: caught } = this;

    if (!caught) throw rule('retry() must be called in a .catch handler.');
    if (this._settled) throw rule(`${this.key} has settled; retry cannot run.`);

    this._items.push(run.copy(caught));
    this.arm();
  }

  slot(max: unknown, key: unknown) {
    if (typeof max != 'number' && typeof max != 'function') throw rule('only() takes a count, or a function returning one.');

    const token = this.issue('gate', []);

    this.run._slots.set(token.id, { max: max as Slot['max'], key });
  }

  delay(duration: Record<string, unknown>) {
    let ms = 0;

    if (!Object.keys(duration).length) throw rule('then() takes a duration of ms, sec, min, hr and day as numbers - got none.');

    for (const [unit, value] of Object.entries(duration))
      if (!Object.hasOwn(UNITS, unit) || typeof value != 'number' || !(value >= 0))
        throw rule(`then() takes a duration of ms, sec, min, hr and day as numbers - got ${unit}.`);
      else ms += value * UNITS[unit];

    return Object.assign(this.issue('wait', [ms]), { answers: [] });
  }

  group(members: unknown[]) {
    for (const member of members as Steps.Node[])
      if (!this._items.includes(member)) throw rule(`then() takes steps called by ${this.key}.`);

    const group = Object.assign(this.run.node('then', []), { group: members as Steps.Node[] });

    ISSUED.set(group, this);
    this.run._groups.add(group.id);

    this._items = this._items.filter((item) => !members.includes(item));
    this._items.push(group);
    this.arm();

    return group;
  }

  wait(answers: string[], racers: unknown[]) {
    for (const key of answers) if (key == 'run') throw rule('run cannot answer a wait.');

    const [race] = racers.length ? this.claimed(racers, 'then() races steps called for it - this.then(this.allow, this.timeout(call)).') : [];
    const token = Object.assign(this.issue('wait', []), { answers }, race && { race });

    if (race) adopt(this.run._parent, [race], token.id);

    return token;
  }

  commit(out: unknown) {
    const { run, id, key, _items: items, _violation, _late, _wake, _lost, _on } = this;

    if (_violation) throw rule(`${key} wrote ${_violation} after scheduling ${items[0].key}.`);
    if (_late && !items.length) throw rule('run awaited work before its plan - it takes arguments, calls steps and awaits this.');
    if (_late) throw rule(`${key} kept working after scheduling ${items[0].key}.`);

    const root = id == run._root;

    if (!root && out !== undefined) throw rule(`${key} returned a value; a step returns nothing - its undo is this.then.on({ reset }).`);

    const end = items.findIndex((item) => item.key == 'end');

    if (end >= 0 && end < items.length - 1) throw rule('end must be the last call in a step.');

    adopt(run._parent, items, id);

    const entry: Steps.Entry = { ...this.journal(), next: items };

    if (_wake) entry.wake = _wake;
    if (this._retried) entry.retried = this._retried;

    if (_on.length) {
      entry.on = grouped(_on);
      run._on.set(id, _on);
    }

    if (_lost.size && !_on.some((handler) => handler.kind == 'reset')) entry.irreversible = [..._lost];

    if (!root) run._held.set(id, { prior: this._prior, log: this._log });
    if (this._undo) run._spent.add(id);

    run._entries.push(entry);
    this._entry = entry;

    return entry;
  }

  journal(): Steps.Entry {
    const { id, key, args, _wrote, _changed, _committed } = this;
    const entry: Steps.Entry = { id, key, args, next: [], wrote: [...new Set([..._wrote, ..._changed])] };

    if (_committed) entry.committed = true;

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
            const out = this.change(key, () => op(...args));

            return out === target ? wrapper : out;
          };

        const got = Reflect.get(target, prop, target);

        return typeof got == 'function' ? got.bind(target) : got;
      }
    });

    this._wrappers.set(value, wrapper);

    return wrapper;
  }

  change(key: string, op: () => Change) {
    const at = this._settled ? this.live() : this;

    if (!at) return op()[0];

    const [out, changed, undo, lost] = op();

    if (!changed) return out;
    if (at._items.length) at._violation ||= key;
    if (undo) at._log.push([key, undo]);
    if (lost) at._lost.add(key);

    at._changed.add(key);
    at.run._writer.set(key, at.id);

    return out;
  }
}

class Wait extends Model {
  run = get(Run);
  id = '';
  step = '';
  args: unknown[] = [];
  answers: string[] = [];
  until?: number = undefined;

  _from!: Frame;
  _park!: (answer?: Answer) => void;
  _answer?: Answer = undefined;
  _race?: Steps.Node = undefined;
  _open = true;

  protected new() {
    const { run, answers, until } = this;
    const { _self: self } = run.control;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const arm = () => {
      const left = until! - Date.now();

      timer = setTimeout(left > LONGEST ? arm : () => run.waits.delete(this), Math.min(left, LONGEST));
    };

    if (until !== undefined) arm();

    for (const key of answers) if (!run.accepts(key, this)) event(self, key);

    return () => {
      this._open = false;
      clearTimeout(timer);

      for (const key of answers) if (!run.accepts(key)) event(self, key);

      this._park(this._answer);
    };
  }
}

function chain(error: unknown, cause: unknown) {
  if (error instanceof Error && error.cause === undefined) error.cause = cause;
}

function grouped(on: Handler[]) {
  const out: NonNullable<Steps.Entry['on']> = {};

  for (const { kind, node } of on) (out[kind] ||= []).push(node);

  return out;
}

function serial(error: unknown) {
  if (!(error instanceof Error)) return error;

  const { name, message, cause } = error;

  return { name, message, ...cause !== undefined && { cause } };
}

function rule(message: string) {
  const error = new Error(message);

  RULES.add(error);

  return error;
}

function named(key: string) {
  return key == 'gate' ? 'a gate' : `${key}()`;
}

function plain(value: unknown) {
  if (!value || typeof value != 'object') return false;

  const proto = Object.getPrototypeOf(value);

  return proto === Object.prototype || proto === null;
}

function signal(key: unknown) {
  return typeof key != 'boolean' && key !== null;
}

function iterable(value: unknown): value is Iterable<unknown> {
  return value != null && typeof (value as Iterable<unknown>)[Symbol.iterator] == 'function';
}

function valueless(args: unknown[]) {
  if (args.length) throw rule('end() takes no value; the result is what run returns.');
}

function outside(key: string, verb = 'called'): never {
  throw rule(`${key} must be ${verb} inside a step.`);
}

class Handled<T> extends Promise<T> {
  static get [Symbol.species]() {
    return Promise;
  }

  declare _ticket: Ticket;

  then<A = T, B = never>(...args: Parameters<Promise<T>['then']>): Promise<A | B> {
    this._ticket.awaited = true;
    return super.then(...args) as Promise<A | B>;
  }
}

function handle<T>(ticket: Ticket, executor: ConstructorParameters<typeof Promise<T>>[0]) {
  const handled = new Handled<T>(executor);

  handled._ticket = ticket;
  Promise.prototype.then.call(handled, undefined, () => {});

  return handled;
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

function adopt(parents: Map<string, string>, items: Steps.Node[], parent: string) {
  for (const item of items) {
    parents.set(item.id, parent);

    if (item.group) adopt(parents, item.group, item.id);
  }
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

export { Steps };
