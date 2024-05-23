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
type OnUpdate<T = any> = 
  (this: T, key: unknown, source: T) => (() => void) | null | void;

type OnAccess<T, R = unknown> = (from: T, key: string | number, value: R) => unknown;

type Event = number | string | null | boolean | symbol;

const DISPATCH = new Set<() => void>();
const OBSERVER = new WeakMap<{}, OnAccess<any>>();
const LISTENER = new WeakMap<{}, Map<OnUpdate, Set<Event> | undefined>>();

/** Events pending for a given object. */
const PENDING = new WeakMap<{}, Set<Event>>();

/** Placeholder event determines if model is initialized or not. */
const onReady = () => null;

function addListener(subject: {}, callback: OnUpdate, select?: Event){
  let subs = LISTENER.get(subject)!;

  if(!subs)
    LISTENER.set(subject, subs = new Map([[onReady, undefined]]));

  const filter = select === undefined ? undefined : new Set([select]);

  if(!subs.has(onReady) && !filter)
    callback(true, subject);

  subs.set(callback, filter);

  return () => subs.delete(callback);
}

function setObserver<T extends {}>(from: T, observer: OnAccess<T>){
  if(OBSERVER.has(from))
    throw new Error("Observer exists for this context.");
    
  OBSERVER.set(from, observer);

  return () => OBSERVER.delete(from);
}

function watch(from: any, key: string | number, value?: any){
  const access = OBSERVER.get(from);
  return access ? access(from, key, value) : value;
}

function emit(source: {}, key: Event){
  const subs = LISTENER.get(source)!;
  const ready = !subs.has(onReady);

  if(key === true && ready)
    return;

  let pending = PENDING.get(source);

  if(pending){
    pending.add(key);
    return;
  }

  PENDING.set(source, pending = new Set(
    key !== true && ready ? [key] : [true, key]
  ));

  pending.forEach(key => {
    pending!.delete(key);
    subs.forEach((select, callback) => {
      let after;
      
      if(!select || select.has(key))
        if(after = callback.call(source, key, source))
          queue(after);
  
      if(after === null || key === null)
        subs.delete(callback);
    });
  })
  
  PENDING.delete(source);
}

function queue(eventHandler: (() => void)){
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

type Effect<T extends {}> = (this: T, argument: T) =>
  ((update: boolean | null) => void) | Promise<void> | null | void;

/**
 * Create a side-effect which will update whenever values accessed change.
 * Callback is called immediately and if ever values are stale.
 * 
 * @param target - Instance of Model to observe.
 * @param callback - Function to invoke when values change.
 * @param requireValues - If `true` will throw if accessing a value which is `undefined`.
 */
function createEffect<T extends {}>(target: T, callback: Effect<Required<T>>, requireValues: true): () => void;
function createEffect<T extends {}>(target: T, callback: Effect<T>, requireValues?: boolean): () => void;
function createEffect<T extends {}>(target: T, callback: Effect<T>, requireValues?: boolean){
  const listeners = LISTENER.get(target)!;

  let unset: ((update: boolean | null) => void) | undefined;
  let reset: (() => void) | null | undefined;

  function invoke(){
    let stale: boolean | undefined;

    const subscriber = Object.create(target);

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

    function access(from: any, key: string | number, value: any) {
      if(value === undefined && requireValues)
        throw new Error(`${from}.${key} is required in this context.`);

      const listeners = LISTENER.get(from)!;
      let listener = listeners.get(onUpdate);

      if(!listener)
        listeners.set(onUpdate, listener = new Set);

      listener.add(key);

      const nested = LISTENER.get(value);

      if(nested){
        LISTENER.set(value = Object.create(value), nested);
        setObserver(value, access);
      }

      return value;
    }

    LISTENER.set(subscriber, listeners);
    setObserver(subscriber, access);

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
  emit,
  OnUpdate,
  queue,
  setObserver,
  watch
}