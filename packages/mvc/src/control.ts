import type { Model } from "./model";

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
type OnUpdate<T extends Model = any> = 
  (this: T, key: unknown, source: T) => (() => void) | null | void;

type OnAccess<T extends Model = any, R = unknown> =
  (from: T, key: string | number, value: R) => unknown;

type Effect<T extends Model> = (this: T, proxy: T) =>
  ((update: boolean | null) => void) | Promise<void> | null | void;

type Event = number | string | null | boolean | symbol;

/** Placeholder event determines if model is initialized or not. */
const onReady = () => null;

const LISTENERS = new WeakMap<Model, Map<OnUpdate, Set<Event> | undefined>>();

/** Events pending for a given object. */
const PENDING = new WeakMap<Model, Set<Event>>();

/** Central event dispatch. Bunches all updates to occur at same time. */
const DISPATCH = new Set<() => void>();

const OBSERVER = new WeakMap<Model, OnAccess>();

function addListener<T extends Model>(subject: T, callback: OnUpdate<T>, select?: Event){
  let listeners = LISTENERS.get(subject)!;

  if(!listeners)
    LISTENERS.set(subject, listeners = new Map([[onReady, undefined]]));

  const filter = select === undefined ? undefined : new Set([select]);

  if(!listeners.has(onReady) && !filter)
    callback.call(subject, true, subject);

  listeners.set(callback, filter);

  return () => listeners.delete(callback);
}

function emit(source: Model, key: Event){
  const listeners = LISTENERS.get(source)!;
  const isActive = !listeners.has(onReady);

  if(key === true && isActive)
    return;

  let pending = PENDING.get(source);

  if(pending){
    pending.add(key);
    return;
  }

  PENDING.set(source, pending = new Set(isActive ? [key] : [true, key]));

  for(const key of pending)
    for(const [callback, filter] of listeners)
      if(!filter || filter.has(key)){
        const after = callback.call(source, key, source);

        if(after)
          enqueue(after);

        else if(after === null)
          listeners.delete(callback);
      }

  if(key === null)
    listeners.clear();
  
  PENDING.delete(source);
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

function createProxy<T extends Model>(from: T, observer: OnAccess<T>){
  const proxy = Object.create(from) as T;
  OBSERVER.set(proxy, observer);
  return proxy;
}

function watch(from: any, key: string | number, value?: any){
  const access = OBSERVER.get(from);
  return access ? access(from, key, value) : value;
}

/**
 * Create a side-effect which will update whenever values accessed change.
 * Callback is called immediately and if ever values are stale.
 * 
 * @param target - Instance of Model to observe.
 * @param callback - Function to invoke when values change.
 * @param requireValues - If `true` will throw if accessing a value which is `undefined`.
 */
function createEffect<T extends Model>(target: T, callback: Effect<Required<T>>, requireValues: true): () => void;
function createEffect<T extends Model>(target: T, callback: Effect<T>, requireValues?: boolean): () => void;
function createEffect<T extends Model>(target: T, callback: Effect<T>, requireValues?: boolean){
  const listeners = LISTENERS.get(target)!;

  let unset: ((update: boolean | null) => void) | undefined;
  let reset: (() => void) | null | undefined;

  function invoke(){
    let stale: boolean | undefined;

    const subscriber = createProxy(target, access);

    LISTENERS.set(subscriber, listeners);

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

    function access(from: Model, key: string | number, value: any) {
      if(value === undefined && requireValues)
        throw new Error(`${from}.${key} is required in this context.`);

      const listeners = LISTENERS.get(from)!;
      let listener = listeners.get(onUpdate);

      if(!listener)
        listeners.set(onUpdate, listener = new Set);

      listener.add(key);

      const nested = LISTENERS.get(value);

      if(nested)
        LISTENERS.set(
          value = createProxy(value, access),
          nested
        );

      return value;
    }

    try {
      const out = callback.call(subscriber, subscriber);

      unset = typeof out == "function" ? out : undefined;
      reset = out === null ? out : invoke;
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

  addListener(target, key => {
    if(key === true)
      invoke();

    else if(!reset)
      return reset;

    if(key === null && unset)
      unset(null);
  });

  return () => {
    if(unset)
      unset(false);

    reset = null;
  };
}

export {
  addListener,
  createEffect,
  createProxy,
  emit,
  OnUpdate,
  enqueue,
  watch
}