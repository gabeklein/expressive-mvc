/**
 * Update callback function.
 * 
 * @param key -
 *   - `string` - property which has updated.
 *   - `true` - initial event; instance is now ready.
 *   - `false` - a normal update has completed.
 *   - `null` - terminal event; instance is expired.
 * @param source - Instance of Model for which update has occured.
 */
type OnUpdate<T = any> = (this: T, key: unknown, source: T) => (() => void) | null | void;

const DISPATCH = new Set<() => void>();
const OBSERVER = new WeakMap<{}, OnUpdate>();
const LISTENER = new WeakMap<{}, Map<OnUpdate, Set<unknown> | false>>();

function onReady(){
  return null;
}

function addListener(
  subject: {},
  callback: OnUpdate,
  select?: number | string | null | true){

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
  }

  return value;
}

const PENDING = new WeakMap<{}, Set<unknown>>();

function event(source: {}, key: unknown | boolean | null){
  const subs = LISTENER.get(source)!;

  let pending = PENDING.get(source);

  if(pending){
    pending.add(key);
    return;
  }

  PENDING.set(source, pending = new Set(
    key !== true && subs.has(onReady) ? [true, key] : [key]
  ));

  pending.forEach(key => {
    pending!.delete(key);
    subs.forEach((select, callback) => {
      let after;
      
      if(!select || select.has(key as string))
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

function effect<T extends {}>(target: T, callback: Effect<T>){
  const listeners = LISTENER.get(target)!;

  let unSet: ((update: boolean | null) => void) | false = false;
  let refresh: (() => void) | null | undefined;

  function invoke(){
    let expired: boolean | undefined;

    const subscriber = Object.create(target);

    LISTENER.set(subscriber, listeners);
    OBSERVER.set(subscriber, () => {
      if(expired)
        return null;

      expired = true;

      if(refresh && unSet){
        unSet(true);
        unSet = false;
      }

      return refresh;
    });

    try {
      const out = callback.call(subscriber, subscriber);

      unSet = typeof out == "function" && out;
      refresh = out === null ? out : invoke;
    }
    catch(err){
      if(err instanceof Promise){
        refresh = undefined;
        err.then(invoke).catch(console.error);
      }
      else if(refresh)
        console.error(err);
      else
        throw err;
    }
  }

  addListener(target, key => {
    if(key === true)
      invoke();

    else if(!refresh)
      return refresh;

    if(key === null && unSet)
      unSet(null);
  });

  return () => {
    if(unSet)
      unSet(false);

    refresh = null;
  };
}

export {
  addListener,
  effect,
  event,
  OnUpdate,
  queue,
  watch
}