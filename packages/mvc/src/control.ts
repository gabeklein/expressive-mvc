/**
 * Update callback function.
 * 
 * @param key -
 *   - `string` - property which has updated.
 *   - `false` - a normal update has completed.
 *   - `true` - initial event; instance is ready.
 *   - `null` - terminal event; instance is expired.
 * @param source - Instance of Model for which update has occured.
 */
type OnUpdate<T extends {} = any> = 
  (this: T, key: unknown, source: T) => (() => void) | null | void;

type Effect<T extends {}> = (this: T, proxy: T) =>
  ((update: boolean | null) => void) | Promise<void> | null | void;

type Event = number | string | null | boolean | symbol;

const {} = Symbol("observe");

/** Placeholder event determines if model is initialized or not. */
const onReady = () => null;

const LISTENERS = new WeakMap<{}, Map<OnUpdate, Set<Event> | undefined>>();

/** Events pending for a given object. */
const PENDING = new WeakMap<{}, Set<Event>>();

/** Update register. */
const PENDING_KEYS = new WeakMap<{}, Set<string | number | symbol>>();

/** Central event dispatch. Bunches all updates to occur at same time. */
const DISPATCH = new Set<() => void>();

function addListener<T extends {}>(subject: T, callback: OnUpdate<T>, select?: Event){
  let listeners = LISTENERS.get(subject)!;

  if(!listeners)
    LISTENERS.set(subject, listeners = new Map([[onReady, undefined]]));

  const filter = select === undefined ? undefined : new Set([select]);

  if(!listeners.has(onReady) && !filter)
    callback.call(subject, true, subject);

  listeners.set(callback, filter);

  return () => listeners.delete(callback);
}

function emit(model: {}, key: Event): void {
  const listeners = LISTENERS.get(model)!;
  const notReady = listeners.has(onReady);

  if(key === true && !notReady)
    return;

  let pending = PENDING.get(model);

  if(pending){
    pending.add(key);
    return;
  }

  PENDING.set(model, pending = new Set(notReady ? [true, key] : [key]));

  for(const key of pending)
    for(const [callback, filter] of listeners)
      if(!filter || filter.has(key)){
        const after = callback.call(model, key, model);

        if(after)
          enqueue(after);

        else if(after === null)
          listeners.delete(callback);
      }

  if(key === null)
    listeners.clear();
  
  PENDING.delete(model);
}

function event(
  subject: {},
  key?: string | number | symbol | null,
  silent?: boolean){

  if(key === null)
    return emit(subject, key);

  if(!key)
    return emit(subject, true);

  let pending = PENDING_KEYS.get(subject);

  if(!pending){
    PENDING_KEYS.set(subject, pending = new Set());

    if(!silent)
      enqueue(() => {
        emit(subject, false);
        PENDING_KEYS.delete(subject)
      })
  }

  pending.add(key);

  if(!silent)
    emit(subject, key);
}

function enqueue(eventHandler: (() => void)){
  if(!DISPATCH.size)
    setTimeout(() => {
      DISPATCH.forEach(event => {
        try {
          event();
        }
        catch(err){
          console.error(err);
        }
      });
      DISPATCH.clear();
    }, 0);

  DISPATCH.add(eventHandler);
}

type OnAccess<T extends {} = any, R = unknown> =
  (from: T, key: string | number, value: R) => unknown;

const OBSERVER = new WeakMap<{}, OnAccess>();

function subscribe<T extends {}>(object: T): T {
  const callback = EffectContext

  const proxy = Object.create(object);
  OBSERVER.set(proxy, callback);
  return proxy;
}

// function watch(from: {}, key: string | number, value?: any){
//   const access = OBSERVER.get(from);
//   return access ? access(from, key, value) : value;
// }

/**
 * Create a side-effect which will update whenever values accessed change.
 * Callback is called immediately and whenever values are stale.
 * 
 * @param target - Instance of Model to observe.
 * @param callback - Function to invoke when values change.
 * @param requireValues - If `true` will throw if accessing a value which is `undefined`.
 */
function createEffect<T extends {}>(target: T, callback: Effect<Required<T>>, requireValues: true): () => void;
function createEffect<T extends {}>(target: T, callback: Effect<T>, recursive?: boolean): () => void;
function createEffect<T extends {}>(target: T, callback: Effect<T>, argument?: boolean){
  const listeners = LISTENERS.get(target)!;

  let unset: ((update: boolean | null) => void) | undefined;
  let reset: (() => void) | null | undefined;

  function invoke(){
    let stale: boolean | undefined;

    function onUpdate() {
      if (stale)
        return null;

      stale = true;

      if (reset && unset) {
        unset(true);
        unset = undefined;
      }

      return reset;
    }

    // function access(from: {}, key: string | number | symbol, value: any) {
    //   if(value === undefined && argument){
    //     if(typeof key == "symbol")
    //       key = key.description || "symbol";

    //     throw new Error(`${from}.${key} is required in this context.`);
    //   }

    //   const listeners = LISTENERS.get(from)!;
    //   let listener = listeners.get(onUpdate);

    //   if(!listener)
    //     listeners.set(onUpdate, listener = new Set);

    //   listener.add(key);

    //   const nested = LISTENERS.get(value);

    //   if(nested)
    //     LISTENERS.set(value = subscribe(value, access), nested);

    //   return value;
    // }


    try {
      const subscriber = subscribe(target);

      LISTENERS.set(subscriber, listeners);
      const exit = enter(onUpdate, argument !== false);
      const result = callback.call(subscriber, subscriber);
      const flush = exit()

      reset = result === null ? null : invoke;
      unset = key => {
        if(typeof result == "function")
          result(key);

        flush();
      }
    }
    catch(err){
      if(err instanceof Promise){
        reset = undefined;
        err.then(invoke);
      }
      else
        throw err;
    }
  }

  function cleanup(){
    if(unset)
      unset(false);

    reset = null;
  };

  if(EffectContext && argument !== false)
    EffectContext.cleanup.add(cleanup);

  addListener(target, key => {
    if(key === true)
      invoke();

    else if(!reset)
      return reset;

    if(key === null && unset)
      unset(null);
  });
  
  return cleanup;
}

let EffectContext: {
  cleanup: Set<() => void>;
  onUpdate: (() => (() => void) | null | undefined);
  require?: boolean;
} | undefined;

export function enter(
  onUpdate?: (() => (() => void) | null | undefined),
  ignore?: boolean){

  if(ignore)
    return () => () => {};

  const last = EffectContext;
  const cleanup = new Set<() => void>();

  EffectContext = { cleanup, onUpdate: last?.onUpdate };

  return () => {
    EffectContext = last;
    return () => {
      cleanup.forEach(fn => fn());
      cleanup.clear();
    };
  }
}

export {
  addListener,
  createEffect,
  event,
  OnUpdate,
  PENDING_KEYS
}