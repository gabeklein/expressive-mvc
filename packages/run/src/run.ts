import { get, has, map, State, unbind } from '@expressive/mvc';
import { event, listener, touch } from '@expressive/mvc/observable';

type Collection = has.List<unknown> | has.Pool<unknown> | map.Managed<unknown, unknown>;

interface Held {
  key: string;
  value: Collection;
  raw: unknown[] | Map<unknown, unknown>;
  prior: unknown;
  readers: Set<Frame>;
  release(): void;
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

const HOOK = /^(before|after)([A-Z]|$)/;
const KEYS = ['status', 'active', 'record', 'queue', 'waiting', 'runs', 'error'] as const;
const SLACK = 8;

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
     * Inside a step: call `each` per item - a function issuing a step, or a step itself -
     * and run the tokens as one parallel group.
     */
    <I, This>(this: This, items: Iterable<I>, each: (item: I, index: number) => unknown): void;

    /**
     * Inside a step: an anonymous step at this point in the plan, given an `AbortSignal` aborted
     * when the run stops. Returned, it is the step's undo. Not durable.
     */
    <This>(this: This, step: (signal: AbortSignal) => unknown): void;

    /**
     * Inside a step: park this point in the plan until a call to one of these steps answers it -
     * from outside, or from a watcher: a plain function started when the plan reaches the wait,
     * given an `AbortSignal` aborted once the wait closes. The next step in sequence runs once
     * the answer, and all it schedules, is done. Returned, it parks the unwind until answered.
     */
    <This>(this: This, ...steps: [...steps: ((...args: any[]) => unknown)[], watcher: (signal: AbortSignal) => unknown]): void;

    <This>(
      this: This,
      ...steps: [...steps: ((...args: any[]) => unknown)[], watcher: (signal: AbortSignal) => unknown, other: (signal: AbortSignal) => unknown]
    ): void;

    <This>(this: This, ...steps: ((...args: any[]) => unknown)[]): void;

    /**
     * Inside a step: run these tokens as one parallel group at this point in the plan.
     * The next step in sequence runs once every member, and all it schedules, is done.
     * Returned, its members are the step's undo.
     */
    <This>(this: This, ...steps: unknown[]): void;

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
  const runner = function (onfulfilled?: unknown, onrejected?: unknown) {
    if (onfulfilled && typeof onfulfilled == 'object') throw new Error('then(steps) must be called inside a step.');

    return control.settled().then(onfulfilled as any, onrejected as any);
  } as Runner<T>;

  const control = Control.new({ _self: self, _runner: runner });

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
    stop: { value: (options?: Runner.Stop) => control.stop(options) },
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

  for (const hook of hooks) {
    const target = hook.replace(HOOK, (_, __, first: string) => first.toLowerCase());

    if (target && !control._steps.has(target)) throw new Error(`${hook} has no step ${target}.`);
  }

  self.get(null, () => control.stop());

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

class Control extends State {
  status: Runner.Status = 'idle';
  active: string | undefined = undefined;
  runs = 0;
  error: unknown = undefined;
  queue = has<Ticket>();
  run = new Run();

  _self!: State;
  _runner!: object;
  _steps = new Map<string, Function>();
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
    run.end(run.node('end', value === undefined ? [] : [value]));
  }

  stop(options: Runner.Stop = {}) {
    const { _current: current, queue } = this;

    if (!current) return;

    const stopped = Object.assign(new Error(`${this._self} was stopped.`), { name: 'Stopped' });

    for (const ticket of queue) ticket.reject(stopped);

    queue.clear();
    current._stopped = stopped;
    current.release();
    current.halt('stopped', undefined, options.undo);
  }
}

class Run extends State {
  control = get(Control);
  record = has<Runner.Entry>();
  frames = has(Frame);
  waits = has(Wait);

  _ticket!: Ticket;
  _counts = new Map<string, number>();
  _undo = new Map<string, Undo>();
  _held = new Map<string, Map<string, Held>>();
  _captures = new Map<Collection, Held>();
  _inline = new Map<string, Function>();
  _watchers = new Map<string, Function[]>();
  _drained: (() => void)[] = [];
  _end?: Runner.Node = undefined;
  _halted?: 'failed' | 'stopped' = undefined;
  _ending?: boolean = undefined;
  _error?: unknown = undefined;
  _stopped?: Error = undefined;
  _warned?: boolean = undefined;
  _quiet = false;

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

    return { id: `${key}#${count}`, key, args };
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

  async exec(item: Runner.Node, from?: Frame): Promise<void> {
    if (this._halted || this._ending) return;

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
    else if (item.key != 'end') await this.descend(await this.invoke(item));
  }

  async descend(frame?: Frame) {
    if (frame) for (const child of frame._items) await this.exec(child, frame);
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

    wait._answer = answer;
    this.waits.delete(wait);
    answer.frame = this.invoke(this.node(key, args), wait.id, wait._undo);

    return handle(_ticket, answered);
  }

  release() {
    this.waits.clear();
  }

  async invoke(node: Runner.Node, wake?: string, undo?: boolean): Promise<Frame | undefined> {
    const { control } = this;
    const { _self: self } = control;
    const { id, key, args } = node;
    const inline = this._inline.get(id);
    const fn = inline || control._steps.get(key) || (() => {});
    const frame = this.frames.add({ id, key, args, _wake: wake, _undo: undo });
    const input = inline ? [frame._abort.signal] : args;
    const hooks = !undo;

    control.active = key;

    try {
      if (hooks) {
        hook(self, 'before', key, args, false);
        hook(self, `before${capital(key)}`, false, ...args);
      }

      let out: unknown;

      for (let attempt = 1; ; attempt++)
        try {
          out = await fn.apply(frame._proxy, input);
          frame._settled = true;

          const entry = frame.commit(out, attempt);

          if (hooks) {
            hook(self, `after${capital(key)}`, false, entry);
            hook(self, 'after', key, entry, false);
          }

          return frame;
        } catch (error) {
          let irreversible = [...frame._lost];
          let retry = !frame._settled && !irreversible.length && frame._retry && attempt < frame._retry.attempts;

          if (irreversible.length) this.record.push({ ...frame.journal(), error, irreversible, ...frame._retry && { attempt } });
          if (!retry) throw error;

          this.restore(frame._prior, frame.touched());
          frame.leave();
          Object.assign(frame, { _held: new Map(), _changed: new Set() });
          this.record.push({ id, key, args, prior: {}, patch: {}, next: [], attempt, error });

          const delay = frame._retry!.backoff?.(attempt);

          await new Promise((resolve) => (delay ? setTimeout(resolve, delay) : resolve(0)));

          if (this._halted) throw error;

          Object.assign(frame, { _items: [], _wrote: new Set(), _prior: {}, _violation: undefined, _late: undefined });
          frame._armed++;
        }
    } catch (error) {
      frame._settled = true;

      if (!frame._lost.size) this.restore(frame._prior, frame.touched());
      if (undo) throw error;

      this.halt('failed', error);
    } finally {
      this.frames.delete(frame);
      control.active = this.flight().at(-1)?.key;

      if (!this.flight().length) for (const resolve of this._drained.splice(0)) resolve();
    }
  }

  async end(item = this._end) {
    this._ending = true;

    await this.drain();

    if (this._halted) return;
    if (!item) return this.finish(dump(this.control));

    const frame = await this.invoke(item);

    if (frame && !this._halted) this.finish(frame._result);
  }

  drain() {
    if (this.flight().length) return new Promise<void>((resolve) => this._drained.push(resolve));
  }

  finish(value: unknown) {
    this.close();
    this.control.status = 'idle';
    this._ticket.resolve(value);
    this.control.advance();
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

    if (undo) {
      await this.unwind();
      this.back();
    }

    const { _error: error, _ticket } = this;

    this.close();
    _ticket.reject(error === undefined ? this._stopped : error);

    if (error !== undefined)
      queueMicrotask(() => queueMicrotask(() => {
        if (!_ticket.awaited) throw error;
      }));

    this.control.advance();
  }

  async unwind() {
    const { control, record } = this;
    const entries = record.get() as Runner.Entry[];

    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      const undo = this._undo.get(entry.id);

      if (entry.irreversible) {
        entry.halted = true;
        event(record, i);
        console.warn(`${control._self} stopped unwinding at ${entry.id}: ${entry.irreversible.join(', ')} cannot be restored.`);
        break;
      }

      if ('error' in entry) continue;

      try {
        let done = !undo || (await this.undo(entry, undo.how, undo.from));

        if (!done) {
          entry.halted = true;
          break;
        }

        this.restore(entry.prior, this._held.get(entry.id)!);
        entry.undone = true;
      } catch (cause) {
        entry.undone = 'failed';
        this._error = cause;
        control.error = cause;
        break;
      } finally {
        event(record, i);
      }
    }
  }

  back() {
    const { control, _error: error, _stopped } = this;

    try {
      hook(control._self, 'back', error === undefined ? _stopped : error);
    } catch (cause) {
      this._error = cause;
      control.error = cause;
    }
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

    try {
      await answer.frame;
    } catch (error) {
      answer.fail(error);
      throw error;
    }

    answer.done();

    return true;
  }

  capture(key: string, value: Collection) {
    const raw = value instanceof has.List ? value.get(0, value.size) : value instanceof Map ? new Map(value) : [...value];
    const held = { key, value, raw, prior: value.get(), readers: new Set() } as Held;

    held.release = listener(value, (change) => {
      if (this._quiet || !signal(change)) return;

      const gone = lost(held, change);

      for (const reader of held.readers) {
        reader._changed.add(key);
        if (gone) reader._lost.add(key);
      }
    });

    this._captures.set(value, held);

    return held;
  }

  restore(prior: Record<string, unknown>, held: Map<string, Held>) {
    const self = this.control._self as any;

    for (const key in prior) if (!held.has(key)) self[key] = prior[key];

    this._quiet = true;

    try {
      for (const each of held.values()) revert(each);
    } finally {
      this._quiet = false;
    }
  }
}

class Frame extends State {
  run = get(Run);
  id = '';
  key = '';
  args: unknown[] = [];

  _proxy!: State;
  _view?: Runner.Controller = undefined;
  _refs = new Map<string, Function>();
  _abort = new AbortController();
  _items: Runner.Node[] = [];
  _wrote = new Set<string>();
  _prior: Record<string, unknown> = {};
  _held = new Map<string, Held>();
  _changed = new Set<string>();
  _lost = new Set<string>();
  _wake?: string = undefined;
  _undo?: boolean = undefined;
  _retry?: Runner.Retry = undefined;
  _violation?: string = undefined;
  _late?: boolean = undefined;
  _armed = 0;
  _settled?: boolean = undefined;
  _result?: unknown = undefined;

  protected new() {
    const { _self: self, _steps, _runner } = this.run.control;

    this._proxy = new Proxy(self, {
      get: (target, prop) => {
        if (_steps.has(prop as string)) return this.ref(prop as string);

        const value = Reflect.get(target, prop, target);

        if (value === _runner) return this.view();
        if (typeof value != 'function') {
          let fresh = !this._undo && !this._settled && !this._held.has(prop as string) && collection(value);

          if (fresh) this.hold(prop as string, value);

          return value;
        }

        return Object.hasOwn(target, prop) ? value : value.bind(target);
      },
      set: (target, prop, value) => {
        const key = String(prop);

        if (this._settled) return Reflect.set(target, prop, value, target);

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
      this.leave();
    };
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
      retry: { value: (config: Runner.Retry) => void (this._retry = config) }
    });

    return (this._view = view as unknown as Runner.Controller);
  }

  group(members: unknown[]) {
    for (const member of members)
      if (!this._items.includes(member as Runner.Node)) throw new Error(`then() takes steps called by ${this.key}.`);

    const group = { ...this.run.node('then', []), group: members as Runner.Node[] };

    this._items = this._items.filter((item) => !members.includes(item));
    this._items.push(group);
    this.arm();

    return group;
  }

  inline(fn: Function) {
    const token = this.issue('then', []);

    this.run._inline.set(token.id, fn);

    return token;
  }

  wait(answers: string[], watchers: Function[]) {
    for (const key of answers) if (key == 'next' || key == 'end') throw new Error(`${key} cannot answer a wait.`);

    const token = Object.assign(this.issue('wait', []), { answers });

    if (watchers.length) this.run._watchers.set(token.id, watchers);

    return token;
  }

  commit(out: unknown, attempt: number) {
    const { run, id, key, args, _items: items, _violation, _late, _wake, _lost } = this;

    if (_violation) throw new Error(`${key} wrote ${_violation} after scheduling ${items[0].key}.`);
    if (_late) throw new Error(`${key} kept working after scheduling ${items[0].key}.`);

    let undo: Function | Runner.Node | undefined;
    let token = items.includes(out as Runner.Node);

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

    for (const item of items)
      if (item.key == 'end') {
        if (run._end) throw new Error('end was scheduled twice.');

        run._end = item;
      }

    const entry: Runner.Entry = { ...this.journal(), next: items };

    if (_wake) entry.wake = _wake;
    if (attempt > 1) entry.attempt = attempt;

    if (undo) {
      entry.undo = typeof undo == 'function' ? 'closure' : undo;
      run._undo.set(id, { how: undo, from: this });
    }
    else if (_lost.size) entry.irreversible = [..._lost];

    run._held.set(id, this.touched());
    run.record.push(entry);

    return entry;
  }

  journal(): Runner.Entry {
    const { run, id, key, args, _wrote, _prior, _held, _changed } = this;
    const values = run.control._self.get() as Record<string, unknown>;
    const collections = [..._changed].map((key) => [key, _held.get(key)!.prior]);
    const patch = Object.fromEntries([..._wrote, ..._changed].map((key) => [key, values[key]]));

    return { id, key, args, prior: { ..._prior, ...Object.fromEntries(collections) }, patch, next: [] };
  }

  hold(key: string, value: Collection) {
    const { run } = this;
    const held = run._captures.get(value) || run.capture(key, value);

    held.readers.add(this);
    this._held.set(key, held);
  }

  leave() {
    for (const each of this._held.values()) {
      each.readers.delete(this);

      if (each.readers.size) continue;

      each.release();
      this.run._captures.delete(each.value);
    }
  }

  touched() {
    const { _held, _changed } = this;

    return new Map([..._changed].map((key) => [key, _held.get(key)!]));
  }
}

class Wait extends State {
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
    if (!this._undo) return run.halt('failed', error);

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

function outside(key: string): never {
  throw new Error(`${key} must be called inside a step.`);
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

function hook(self: State, key: string, ...args: unknown[]) {
  (self as any)[key]?.(...args);
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

function lost({ value, raw }: Held, signal: unknown) {
  if (value instanceof has.Pool) return (raw as unknown[]).includes(signal) && !value.has(signal);
  if (value instanceof Map) return dead((raw as Map<unknown, unknown>).get(signal));

  return false;
}

function dead(value: unknown) {
  return value instanceof State && value.get(null);
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

export { Job, run, Runner };
