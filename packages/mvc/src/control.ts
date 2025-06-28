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
type OnUpdate<T extends Observable = any> = 
  (this: T, key: unknown, source: T) => (() => void) | null | void;

type Effect<T extends Observable> = (this: T, proxy: T) =>
  ((update: boolean | null) => void) | Promise<void> | null | void;

type Event = number | string | null | boolean | symbol;

namespace Observable {
  export type Callback<T> = (object: T, key: string | number | symbol, value: unknown) => void;
}

interface Observable {
  [Observable](callback: Observable.Callback<this>): this;
}

const Observable = Symbol("observe");

/** Placeholder event determines if model is initialized or not. */
const onReady = () => null;

const LISTENERS = new WeakMap<Observable, Map<OnUpdate, Set<Event> | undefined>>();

/** Events pending for a given object. */
const PENDING = new WeakMap<Observable, Set<Event>>();

/** Update register. */
const PENDING_KEYS = new WeakMap<Observable, Set<string | number | symbol>>();

/** Central event dispatch. Bunches all updates to occur at same time. */
const DISPATCH = new Set<() => void>();

function addListener<T extends Observable>(subject: T, callback: OnUpdate<T>, select?: Event){
  let listeners = LISTENERS.get(subject)!;

  if(!listeners)
    LISTENERS.set(subject, listeners = new Map([[onReady, undefined]]));

  const filter = select === undefined ? undefined : new Set([select]);

  if(!listeners.has(onReady) && !filter)
    callback.call(subject, true, subject);

  listeners.set(callback, filter);

  return () => listeners.delete(callback);
}

function emit(model: Observable, key: Event): void {
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
  subject: Observable,
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

/**
 * Create a side-effect which will update whenever values accessed change.
 * Callback is called immediately and whenever values are stale.
 * 
 * @param target - Instance of Model to observe.
 * @param callback - Function to invoke when values change.
 * @param requireValues - If `true` will throw if accessing a value which is `undefined`.
 */
function createEffect<T extends Observable>(target: T, callback: Effect<Required<T>>, requireValues: true): () => void;
function createEffect<T extends Observable>(target: T, callback: Effect<T>, recursive?: boolean): () => void;
function createEffect<T extends Observable>(target: T, callback: Effect<T>, argument?: boolean){
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

    function access(from: Observable, key: string | number | symbol, value: any) {
      if(value === undefined && argument){
        if(typeof key == "symbol")
          key = key.description || "symbol";

        throw new Error(`${from}.${key} is required in this context.`);
      }

      const listeners = LISTENERS.get(from)!;
      let listener = listeners.get(onUpdate);

      if(!listener)
        listeners.set(onUpdate, listener = new Set);

      listener.add(key);

      const nested = LISTENERS.get(value);

      if(nested)
        LISTENERS.set(value = value[Observable](access), nested);

      return value;
    }

    const subscriber = target[Observable](access);

    LISTENERS.set(subscriber, listeners);

    try {
      const exit = enter(argument === false)
      const ret = callback.call(subscriber, subscriber);
      const flush = exit();

      reset = ret === null ? null : invoke;
      unset = key => {
        if(typeof ret == "function")
          ret(key);

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
    EffectContext.add(cleanup);

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

let EffectContext: Set<() => void> | undefined;

export function enter(ignore?: boolean){
  if(ignore)
    return () => () => {};

  const last = EffectContext;
  const context = EffectContext = new Set;

  return () => {
    EffectContext = last;
    return () => context.forEach(fn => fn());
  }
}

export {
  addListener,
  createEffect,
  event,
  OnUpdate,
  PENDING_KEYS,
  Observable
}