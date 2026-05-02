declare namespace Observable {
  /**
   * Update callback function.
   *
   * @param key -
   *   - `string` - property which has updated.
   *   - `false` - a normal update has completed.
   *   - `true` - initial event; instance is ready.
   *   - `null` - terminal event; instance is expired.
   * @param source - Instance for which update has occured.
   */
  type Notify<T extends object = any> = (
    this: T,
    key: Signal,
    source: T
  ) => (() => void) | null | void;

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

/** Lifecycle status for any observable: false = pending, true = ready, null = terminated. */
const READY = new WeakMap<object, true | null>();

const LISTENERS = new WeakMap<
  object,
  Map<Observable.Notify, Set<Observable.Signal> | undefined>
>();

/** Events pending for a given object. */
const PENDING = new WeakMap<object, Set<Observable.Signal>>();

/** Update register. */
const EMITING = new WeakMap<object, Set<string | number | symbol>>();

/** Central event dispatch. Bunches all updates to occur at same time. */
const DISPATCH = new Set<() => void>();

const OBSERVER = new WeakMap<object, (key: any, value: any) => any>();

/**
 * Resolve to the real instance behind a watch-proxy.
 * Proxies created by `observe` sit one `Object.create` hop above the real subject;
 * if the input itself isn't registered, look one prototype up.
 */
function resolve<T extends object>(state: T): T {
  if (LISTENERS.has(state)) return state;
  const proto = Object.getPrototypeOf(state);
  return proto && LISTENERS.has(proto) ? proto : state;
}

/**
 * Check if an object is observable and return its status.
 * - `true` if ready
 * - `false` if pending
 * - `null` if expired
 * - `undefined` if not observable.
 */
function observable(state: object): boolean | null | undefined {
  state = resolve(state);
  if (LISTENERS.has(state)) {
    const status = READY.get(state);
    return status === undefined ? false : status;
  }
}

function observe<T extends object>(
  object: T,
  callback: Observable.Callback,
  required?: boolean
): T {
  const watching = new Set<Observable.Signal>();

  listener(object, (key) => {
    if (watching.has(key)) return callback();
  });

  const proxy = Object.create(object);

  OBSERVER.set(proxy, (key, value) => {
    if (value === undefined && required)
      throw new Error(`${object}.${key} is required in this context.`);

    watching.add(key);

    if (value instanceof Object && LISTENERS.has(resolve(value)))
      return observe(value, callback, required);

    return value;
  });

  return proxy as T;
}

function touch(from: object, key: any, value?: any) {
  const observe = OBSERVER.get(from);
  return observe ? observe(key, value) : value;
}

function listener<T extends object>(
  subject: T,
  callback: Observable.Notify<T>,
  select?: Observable.Signal | Set<Observable.Signal>
) {
  subject = resolve(subject);

  let listeners = LISTENERS.get(subject)!;

  if (!listeners) LISTENERS.set(subject, (listeners = new Map()));

  if (select !== undefined && !(select instanceof Set))
    select = new Set([select]);

  if (READY.has(subject) && !select) {
    callback.call(subject, true, subject);
  }

  listeners.set(callback, select);

  return () => listeners.delete(callback);
}

const EMPTY = Object.assign([], {
  then: Promise.prototype.then.bind(Promise.resolve([]))
} as PromiseLike<never[]>);

function pending<K extends Observable.Event>(
  state: object
): K[] & PromiseLike<K[]> {
  state = resolve(state);
  const current = EMITING.get(state) as Set<K> | undefined;

  if (!current) return EMPTY;

  const listeners = LISTENERS.get(state)!;
  const promise = new Promise<K[]>((res) => {
    const callback: Observable.Notify = (key) => {
      listeners.delete(callback);
      return () => res([...current]);
    };

    listeners.set(callback, undefined);
  });

  return Object.assign([...current], {
    then: promise.then.bind(promise)
  });
}

function event(
  state: object,
  key?: Observable.Event | null,
  silent?: boolean
) {
  state = resolve(state);

  if (key === null) return emit(state, key);

  if (key === undefined) return emit(state, true);

  let pending = EMITING.get(state);

  if (!pending) {
    EMITING.set(state, (pending = new Set()));

    if (!silent)
      enqueue(() => {
        emit(state, false);
        EMITING.delete(state);
      });
  }

  pending.add(key);

  if (!silent) emit(state, key);
}

function emit(state: object, key: Observable.Signal): void {
  const isReady = READY.has(state);

  if (key === true && isReady) return;

  let pending = PENDING.get(state);

  if (pending) {
    pending.add(key);
    return;
  }

  PENDING.set(state, (pending = new Set(isReady ? [key] : [true, key])));

  const listeners = LISTENERS.get(state)!;

  for (const key of pending)
    for (const [callback, filter] of listeners)
      if (!filter || filter.has(key)) {
        const after = callback.call(state, key, state);

        if (after) {
          enqueue(after);
        } else if (after === null) {
          listeners.delete(callback);
        }
      }

  if (key === null) listeners.clear();

  if (key === true || key === null) READY.set(state, key);

  PENDING.delete(state);
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
  callback: Observable.Effect<Required<T>>,
  requireValues: true
): () => void;

function watch<T extends object>(
  target: T,
  callback: Observable.Effect<T>,
  recursive?: boolean
): () => void;

function watch<T extends object>(
  target: T,
  callback: Observable.Effect<T>,
  argument?: boolean
) {
  let cause: readonly Observable.Event[] = [];
  let unset: ((update: boolean | null) => void) | undefined;
  let reset: (() => void) | null | undefined;

  function invoke() {
    let ignore: boolean = true;

    function onUpdate() {
      cause = [...(EMITING.get(target) || [])];

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
  Observable,
  touch,
  pending,
  observable,
  watch,
  capture
};
