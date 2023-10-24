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
    LISTENER.set(subject, subs = new Map().set(onReady, false));

  const filter = 2 in arguments && new Set([select]);

  if(!filter && !subs.has(onReady))
    callback(true, subject);

  subs.set(callback, filter);

  return () => subs.delete(callback);
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
  callback: (this: T, argument: T) => ((update: boolean | null) => void) | Promise<void> | null | void){

  const listeners = LISTENER.get(target)!;
  let refresh: (() => void) | null | undefined;
  let unSet: ((update: boolean | null) => void) | false | undefined;

  function invoke(){
    let expired: boolean | undefined;

    const local = Object.create(target);
    const update = () => {
      if(expired)
        return null;

      expired = true;

      if(refresh && unSet){
        unSet(true);
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