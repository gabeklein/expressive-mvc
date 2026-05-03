declare namespace Observer {
  /**
   * Update callback function.
   *
   * @param key -
   *   - `string` - property which has updated.
   *   - `false` - a normal update has completed.
   *   - `true` - initial event; instance is ready.
   *   - `null` - terminal event; instance is expired.
   */
  type Notify = (key: Signal) => (() => void) | null | void;

  type EffectCleanup = (update: boolean | null) => void;

  type Effect<T extends object> = (
    this: T,
    proxy: T,
    changed: readonly Event[]
  ) => EffectCleanup | Promise<void> | null | void;

  type Event = number | string | symbol;

  type Signal = Event | true | false | null;

  type Callback = () => void | null;
}

interface Observer {
  /** Lifecycle status: undefined = pending, true = ready, null = terminated. */
  ready?: true | null;
  listeners: Map<Observer.Notify, Set<Observer.Signal> | undefined>;
  /** Recursion guard for an in-progress emit pass. */
  pending: Set<Observer.Signal>;
  /** Accumulator drained by the next microtask. */
  emitting: Set<Observer.Event>;
}

interface Observing {
  callback: Observer.Callback;
  watching: Set<Observer.Signal>;
  required?: boolean;
}

const Observer: unique symbol = Symbol('Observer');
const Observing: unique symbol = Symbol('Observing');

/** Central event dispatch. Bunches all updates to occur at same time. */
const DISPATCH = new Set<() => void>();

interface Observable { [Observer]?: Observer };
interface Observed { [Observing]?: Observing };

function obs(state: object): Observer | undefined;
function obs(state: object, create: true): Observer;
function obs(state: object, create?: boolean) {
  const o = (state as Observable)[Observer];
  if (o) return o;

  if (create) {
    const fresh: Observer = {
      listeners: new Map(),
      pending: new Set(),
      emitting: new Set()
    };
    Object.defineProperty(state, Observer, { value: fresh });
    return fresh;
  }
}

/**
 * Check if an object is observable and return its status.
 * - `true` if ready
 * - `false` if pending
 * - `null` if expired
 * - `undefined` if not observable.
 */
function observable(state: object): boolean | null | undefined {
  const o = obs(state);
  if (o) return o.ready === undefined ? false : o.ready;
}

function observe<T extends object>(
  object: T,
  callback: Observer.Callback,
  required?: boolean
): T {
  const watching = new Set<Observer.Signal>();

  listener(object, (key) => {
    if (watching.has(key)) return callback();
  });

  const proxy = Object.create(object);

  return Object.defineProperty<T>(proxy, Observing, {
    value: { callback, watching, required } as Observing
  });
}

function touch(from: object, key: any, value?: any) {
  const active = (from as Observed)[Observing];

  if (active) {
    if (value === undefined && active.required)
      throw new Error(
        `${Object.getPrototypeOf(from)}.${key} is required in this context.`
      );

    active.watching.add(key);

    if (value instanceof Object && obs(value))
      return observe(value, active.callback, active.required);
  }

  return value;
}

function listener<T extends object>(
  subject: T,
  callback: Observer.Notify,
  select?: Observer.Signal | Set<Observer.Signal>
) {
  const o = obs(subject, true);

  if (select !== undefined && !(select instanceof Set))
    select = new Set([select]);

  if (o.ready !== undefined && !select) callback(true);

  o.listeners.set(callback, select);

  return () => o.listeners.delete(callback);
}

const EMPTY = Object.assign([], {
  then: Promise.prototype.then.bind(Promise.resolve([]))
} as PromiseLike<never[]>);

function pending<K extends Observer.Event>(
  state: object
): K[] & PromiseLike<K[]> {
  const o = obs(state);
  if (!o?.emitting.size) return EMPTY;

  const current = o.emitting as Set<K>;
  const promise = new Promise<K[]>((res) => {
    const callback: Observer.Notify = () => {
      o.listeners.delete(callback);
      return () => res([...current]);
    };
    o.listeners.set(callback, undefined);
  });

  return Object.assign([...current], {
    then: promise.then.bind(promise)
  });
}

function event(state: object, key?: Observer.Event | null, silent?: boolean) {
  const o = obs(state);

  if (!o) return;
  if (key === null) return emit(o, key);
  if (key === undefined) return emit(o, true);

  if (!o.emitting.size && !silent)
    enqueue(() => {
      emit(o, false);
      o.emitting = new Set();
    });

  o.emitting.add(key);

  if (!silent) emit(o, key);
}

function emit(o: Observer, key: Observer.Signal): void {
  const { listeners, pending, ready } = o;

  if (key === true && ready !== undefined) return;

  if (pending.size) {
    pending.add(key);
    return;
  }
  if (ready === undefined) pending.add(true);
  pending.add(key);

  for (const k of pending)
    for (const [callback, filter] of listeners)
      if (!filter || filter.has(k)) {
        const after = callback(k);

        if (after) enqueue(after);
        else if (after === null) listeners.delete(callback);
      }

  if (key === null) listeners.clear();
  if (key === true || key === null) o.ready = key;

  pending.clear();
}

function enqueue(eventHandler: () => void) {
  if (!DISPATCH.size)
    queueMicrotask(() => {
      DISPATCH.forEach((event) => {
        try {
          event();
        } catch (err) {
          console.error(err);
        }
      });
      DISPATCH.clear();
    });

  DISPATCH.add(eventHandler);
}

/**
 * Create a side-effect which will update whenever values accessed change.
 * Callback is called immediately and whenever values are stale.
 *
 * @param target - Instance of State to observe.
 * @param callback - Function to invoke when values change.
 * @param requireValues - If `true` will throw if accessing a value which is `undefined`.
 */
function watch<T extends object>(
  target: T,
  callback: Observer.Effect<Required<T>>,
  requireValues: true
): () => void;

function watch<T extends object>(
  target: T,
  callback: Observer.Effect<T>,
  recursive?: boolean
): () => void;

function watch<T extends object>(
  target: T,
  callback: Observer.Effect<T>,
  argument?: boolean
) {
  let cause: readonly Observer.Event[] = [];
  let unset: ((update: boolean | null) => void) | undefined;
  let reset: (() => void) | null | undefined;

  function invoke() {
    let ignore: boolean = true;

    function onUpdate() {
      cause = [...obs(target)!.emitting];

      if (reset === null) return null;
      if (ignore) return;

      ignore = true;

      unset!(true);
      unset = undefined;

      enqueue(invoke);
    }

    function run(release?: () => void) {
      const proxy = observe(target, onUpdate, argument === true);
      const output = callback.call(proxy, proxy, cause);

      ignore = false;
      reset = output === null ? null : invoke;
      unset = (key) => {
        if (typeof output == 'function') output(key);
        if (release) release();
      };

      cause = [];
    }

    try {
      if (argument !== false) capture(run);
      else run();
    } catch (err) {
      if (err instanceof Promise) {
        reset = undefined;
        err.then(invoke);
      } else {
        throw err;
      }
    }
  }

  function cleanup() {
    if (unset) unset(false);

    reset = null;
  }

  if (EffectContext && argument !== false) EffectContext.add(cleanup);

  listener(target, (key) => {
    if (key === true) invoke();
    else if (!reset) return reset;

    if (key === null && unset) unset(null);
  });

  return cleanup;
}

let EffectContext: Set<() => void> | undefined;

function capture(scope: (release: () => void) => void) {
  const parent = EffectContext;
  const context = (EffectContext = new Set());

  try {
    scope(() => context.forEach((fn) => fn()));
  } finally {
    EffectContext = parent;
  }
}

export {
  listener,
  event,
  Observer as Observable,
  touch,
  pending,
  observable,
  watch,
  capture
};
