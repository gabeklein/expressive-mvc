import { State, unbind } from '@expressive/mvc';

interface Token {
  key: string;
  args: unknown[];
}

interface Frame extends Token {
  handoff?: Token;
  wrote: Set<string>;
  violation?: string;
}

interface Control {
  self: State;
  current?: Frame;
  result: Promise<unknown>;
  awaited: boolean;
  resolve(value: unknown): void;
  reject(error: unknown): void;
}

const CONTROL = new WeakMap<Runner, Control>();
const FRAME = new WeakMap<object, Frame>();
const STEP = new WeakSet<Function>();

declare namespace Runner {
  type Result<T> = T extends { done(...args: infer A): infer R }
    ? R extends void ? A[0] : R
    : State.Values<T>;

  interface Entry extends Token {
    patch: Record<string, unknown>;
    next?: string;
  }
}

class Runner<T extends State = State> extends State {
  status: 'running' | 'done' | 'failed' = 'running';
  step = '';
  error: unknown = undefined;
  entries: Runner.Entry[] = [];

  /** Ends the run after the current step settles. Undeclared `done` on the class resolves with a dump of its public values. */
  done(value?: Runner.Result<T>) {
    handoff(this, 'done', value === undefined ? [] : [value]);
  }

  then<R1 = Runner.Result<T>, R2 = never>(
    onfulfilled?: ((value: Runner.Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): Promise<R1 | R2> {
    const control = CONTROL.get(this.is)!;

    control.awaited = true;

    return control.result.then(onfulfilled as any, onrejected);
  }
}

/**
 * Make this State a run: its methods become steps, each handing off to the next, and the
 * returned Runner is the controller - status, journal, result.
 */
function run<T extends State>(self: T): Runner<T> {
  const runner = new Runner<T>();
  let resolve!: Control['resolve'];
  let reject!: Control['reject'];

  const result = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  result.catch(() => {});

  const control: Control = { self, result, awaited: false, resolve, reject };

  CONTROL.set(runner, control);

  for (let proto = Object.getPrototypeOf(self); proto !== State.prototype; proto = Object.getPrototypeOf(proto))
    for (const [key, desc] of Object.entries(Object.getOwnPropertyDescriptors(proto))) {
      const fn = unbind(desc.get);

      if (key == 'constructor' || key[0] == '_' || !desc.get || typeof fn != 'function' || Object.hasOwn(self, key)) continue;

      const wrapper = function (this: object, ...args: unknown[]) {
        const frame = FRAME.get(this);

        if (frame) return handoff(runner, key, args, frame);

        invoke(runner, key, fn, args);
      };

      STEP.add(wrapper);
      Object.defineProperty(self, key, { value: wrapper, writable: true, configurable: true });
    }

  return runner;
}

function handoff(runner: Runner, key: string, args: unknown[], frame = CONTROL.get(runner.is)!.current) {
  const control = CONTROL.get(runner.is)!;

  if (control.current && !frame) throw new Error(`${control.current.key} is running; ${key} cannot be called from outside.`);

  if (frame?.handoff) throw new Error(`${frame.key} already handed off to ${frame.handoff.key}; cannot call ${key}.`);

  const token = { key, args };

  if (frame) frame.handoff = token;
  else invoke(runner, key, key == 'done' ? (control.self as any).done : undefined, args);

  return token;
}

function invoke(runner: Runner, key: string, fn: Function | undefined, args: unknown[]) {
  const control = CONTROL.get(runner.is)!;
  const { self } = control;

  if (runner.status != 'running') throw new Error(`${self} is ${runner.status}; ${key} cannot run.`);

  const frame: Frame = { key, args, wrote: new Set() };
  const proxy = new Proxy(self, {
    get(target, prop) {
      const value = Reflect.get(target, prop, target);

      if (typeof value != 'function') return value;
      if (STEP.has(value)) return value.bind(proxy);

      return value.bind(target);
    },
    set(target, prop, value) {
      if (typeof prop == 'string') {
        frame.wrote.add(prop);
        if (frame.handoff) frame.violation ||= prop;
      }

      return Reflect.set(target, prop, value, target);
    }
  });

  FRAME.set(proxy, frame);
  control.current = frame;
  runner.step = key;

  let out: unknown;

  try {
    out = fn && fn.apply(proxy, args);
  } catch (error) {
    return fail(runner, control, error);
  }

  Promise.resolve(out).then(() => settle(runner, control, frame, out), (error) => fail(runner, control, error));
}

function settle(runner: Runner, control: Control, frame: Frame, out: unknown) {
  const { key, args, handoff, wrote, violation } = frame;
  const { self } = control;

  if (violation) return fail(runner, control, new Error(`${key} wrote ${violation} after handing off to ${handoff!.key}.`));

  const values = self.get() as Record<string, unknown>;
  const patch = Object.fromEntries([...wrote].map((key) => [key, values[key]]));

  runner.entries = [...runner.entries, { key, args, patch, next: handoff?.key }];
  control.current = undefined;

  if (key == 'done') {
    runner.status = 'done';
    runner.step = '';

    if (out === undefined) out = args.length ? args[0] : dump(self, runner);

    control.resolve(out);
    return;
  }

  if (!handoff) return fail(runner, control, new Error(`${key} settled without handing off.`));

  invoke(runner, handoff.key, handoff.key == 'done' ? (self as any).done : unbind((self as any)[handoff.key]), handoff.args);
}

function dump(self: State, runner: Runner) {
  const values = self.get() as Record<string, unknown>;

  for (const key in self) if ((self as any)[key] === runner) delete values[key];

  return values;
}

function fail(runner: Runner, control: Control, error: unknown) {
  runner.status = 'failed';
  runner.step = '';
  runner.error = error;
  control.current = undefined;
  control.reject(error);

  if (!control.awaited)
    queueMicrotask(() => queueMicrotask(() => {
      if (!control.awaited) throw error;
    }));
}

export { run, Runner };
