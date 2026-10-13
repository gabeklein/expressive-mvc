import { State } from '@expressive/mvc';

interface Token {
  key: string;
  args: unknown[];
}

interface Frame extends Token {
  handoff?: Token;
  wrote: Set<string>;
  violation?: string;
}

interface Entry extends Token {
  patch: Record<string, unknown>;
  next?: string;
}

interface Run {
  current?: Frame;
  journal: Entry[];
  status: 'running' | 'done' | 'failed';
  result: Promise<unknown>;
  awaited: boolean;
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

const RUN = new WeakMap<Runner, Run>();

declare namespace Runner {
  type Result<T> = T extends { done(...args: infer A): infer R }
    ? 0 extends 1 & R ? State.Values<T> : R extends void ? A[0] : R
    : never;

  type Live<T> = T & PromiseLike<Result<T>>;
}

class Runner extends State {
  /** Ends the run. Any step may hand off to it, once. Undeclared, resolves with a dump of public values. */
  done(...args: any[]): any {
    return this.get();
  }

  /** Create and start a run - inputs are its fields, assigned as with any State. The instance is live: `await` it for the result of `done`. */
  static new<T extends State>(this: State.Type<T>, ...args: State.Args<T>): Runner.Live<T> {
    return (State.new as (this: unknown, ...args: unknown[]) => Runner.Live<T>).call(this, ...args);
  }
}

Runner.on({
  type(T) {
    if (T === Runner) return;

    for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(T.prototype))) {
      if (key == 'constructor' || typeof desc.value != 'function') continue;

      if (key == 'then') throw new Error(`${T.name} declares then, which belongs to Runner.`);

      Object.defineProperty(T.prototype, key, { ...desc, value: step(key, desc.value) });
    }
  },
  setup(self) {
    let resolve!: Run['resolve'];
    let reject!: Run['reject'];

    const result = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });

    result.catch(() => {});

    const run: Run = { journal: [], status: 'running', result, awaited: false, resolve, reject };

    RUN.set(self, run);

    self.set((event) => {
      const frame = run.current;
      const key = String(event);

      if (!frame) return;

      frame.wrote.add(key);

      if (frame.handoff && frame.key != 'new') frame.violation ||= key;
    });
  }
});

Object.defineProperties(Runner.prototype, {
  done: {
    value: step('done', Runner.prototype.done),
    writable: true,
    configurable: true
  },
  then: {
    value(this: Runner, onfulfilled?: (value: unknown) => unknown, onrejected?: (reason: unknown) => unknown) {
      const run = RUN.get(this.is)!;

      run.awaited = true;

      return run.result.then(onfulfilled, onrejected);
    },
    writable: true,
    configurable: true
  }
});

function step(key: string, fn: Function) {
  return function (this: Runner, ...args: unknown[]) {
    const self = this.is;
    const run = RUN.get(self)!;
    const { current } = run;

    if (run.status != 'running') throw new Error(`${self} is ${run.status}; ${key} cannot run.`);

    if (!current) {
      invoke(self, run, { key, args: key == 'new' ? [] : args, wrote: new Set() });
      return;
    }

    if (current.handoff) throw new Error(`${current.key} already handed off to ${current.handoff.key}; cannot call ${key}.`);

    return (current.handoff = { key, args });
  };

  function invoke(self: Runner, run: Run, frame: Frame) {
    run.current = frame;

    let out: unknown;

    try {
      out = fn.apply(self, frame.args);
    } catch (error) {
      return fail(run, error);
    }

    Promise.resolve(out).then(() => settle(self, run, frame, out), (error) => fail(run, error));
  }
}

function settle(self: Runner, run: Run, frame: Frame, out: unknown) {
  const { key, args, handoff, wrote, violation } = frame;

  if (violation) return fail(run, new Error(`${key} wrote ${violation} after handing off to ${handoff!.key}.`));

  const values = self.get() as Record<string, unknown>;
  const patch = Object.fromEntries([...wrote].map((key) => [key, values[key]]));

  run.journal.push({ key, args, patch, next: handoff?.key });
  run.current = undefined;

  if (key == 'done') {
    run.status = 'done';
    run.resolve(out === undefined ? args[0] : out);
    return;
  }

  if (!handoff) return fail(run, new Error(`${key} settled without handing off.`));

  (self as any)[handoff.key](...handoff.args);
}

function fail(run: Run, error: unknown) {
  run.status = 'failed';
  run.current = undefined;
  run.reject(error);

  if (!run.awaited)
    queueMicrotask(() => queueMicrotask(() => {
      if (!run.awaited) throw error;
    }));
}

export { Runner };
