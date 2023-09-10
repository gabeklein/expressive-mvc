/**
 * Update callback function.
 * 
 * @param key - Specifies cause for update.
 *   - `string` - property which has updated.
 *   - `true` - the initial event, instance is now ready.
 *   - `false` - non-initial update has completed.
 *   - `null` - model is marked for garbage collection.
 * @param source - Instance of Model for which update has occured.
 */
type OnUpdate<T = any> = (
  this: T, key: unknown | null | boolean, source: T
) => (() => void) | null | void;

const DISPATCH = new Set<() => void>();
const OBSERVER = new WeakMap<{}, OnUpdate>();
const LISTENER = new WeakMap<{}, Map<OnUpdate, Set<unknown> | null>>();

function onReady(this: {}){
  return null;
}

function addListener(to: {}, fn: OnUpdate){
  let subs = LISTENER.get(to)!;

  if(!subs)
    LISTENER.set(to, subs = new Map().set(onReady, null));

  if(!subs.has(onReady))
    fn(true, to);

  subs.set(fn, null);

  return () => subs.delete(fn);
}

function watch(from: any, key?: unknown, value?: any){
  const listeners = LISTENER.get(from)!;
  const observer = OBSERVER.get(from);

  if(observer){
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

function event(source: {}, key: unknown | boolean | null){
  const subs = LISTENER.get(source)!;

  subs.forEach((select, callback) => {
    let after;

    if(!select || select.has(key as string))
      if(after = callback.call(source, key, source))
        queue(after);

    if(after === null || key === null)
      subs.delete(callback);
  });
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

function effect<T extends {}>(
  target: T,
  callback: (this: T, argument: T) => (() => void) | Promise<void> | null | void){

  const listeners = LISTENER.get(target)!;
  let refresh: (() => void) | null | undefined;
  let unSet: (() => void) | false | undefined;

  function invoke(){
    let expired: boolean | undefined;

    const local = Object.create(target);
    const update = () => {
      if(expired)
        return null;

      expired = true;

      if(refresh && unSet){
        unSet();
        unSet = undefined;
      }

      return refresh;
    }

    LISTENER.set(local, listeners);
    OBSERVER.set(local, update);

    try {
      const out = callback.call(local, local);

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
      unSet();
  });

  return () => {
    refresh = null;
  };
}

export {
  addListener,
  effect,
  event,
  watch,
  queue
}