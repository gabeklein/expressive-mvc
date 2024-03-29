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

type Event = number | string | null | boolean | symbol;

const DISPATCH = new Set<() => void>();
const OBSERVER = new WeakMap<{}, OnUpdate>();
const LISTENER = new WeakMap<{}, Map<OnUpdate, Set<unknown> | false>>();
const REQUIRED = new WeakSet();

/** Placeholder event determines if initialized or not. */
const onReady = () => null;

function addListener(
  subject: {},
  callback: OnUpdate,
  select?: Event){

  let subs = LISTENER.get(subject)!;

  if(!subs)
    LISTENER.set(subject, subs = new Map([[onReady, false]]));

  const filter = 2 in arguments && new Set([select]);

  if(!filter && !subs.has(onReady))
    callback(true, subject);

  subs.set(callback, filter);

  return () => subs.delete(callback);
}

function watch(from: any, key?: unknown, value?: any){
  const observer = OBSERVER.get(from);

  if(observer){
    const listeners = LISTENER.get(from)!;

    listeners.set(observer, 
      (listeners.get(observer) || new Set).add(key)  
    );

    const nested = LISTENER.get(value);

    if(nested){
      LISTENER.set(value = Object.create(value), nested);
      OBSERVER.set(value, observer);
    }

    if(value === undefined && REQUIRED.has(from))
      throw new Error(`${from}.${key} is required in this context.`);
  }

  return value;
}

const PENDING = new WeakMap<{}, Set<unknown>>();

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

function queue(event: (() => void)){
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

  DISPATCH.add(event);
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
function effect<T extends {}>(target: T, callback: Effect<Required<T>>, requireValues: true): () => void;
function effect<T extends {}>(target: T, callback: Effect<T>, requireValues?: boolean): () => void;
function effect<T extends {}>(target: T, callback: Effect<T>, requireValues?: boolean){
  const listeners = LISTENER.get(target)!;

  let unset: ((update: boolean | null) => void) | undefined;
  let reset: (() => void) | null | undefined;

  function invoke(){
    let stale: boolean | undefined;

    const subscriber = Object.create(target);

    LISTENER.set(subscriber, listeners);
    OBSERVER.set(subscriber, () => {
      if(stale)
        return null;

      stale = true;

      if(reset && unset){
        unset(true);
        unset = undefined;
      }

      return reset;
    });

    if(requireValues)
      REQUIRED.add(subscriber);

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
  effect,
  emit,
  OnUpdate,
  queue,
  watch
}