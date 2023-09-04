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

const DISPATCH = new Set<Callback>();
const OBSERVER = new WeakMap<{}, OnUpdate>();
const LISTENER = new WeakMap<{}, Map<OnUpdate, Set<unknown> | null>>;

const LIFECYCLE = {
  update: new Set<Callback>(),
  didUpdate: new Set<Callback>()
}

function onReady(this: {}){
  return null;
}

function addListener(to: {}, fn: OnUpdate){
  let subs = LISTENER.get(to)!;

  if(!subs)
    LISTENER.set(to, subs = new Map([[onReady, null]]));

  if(!subs.has(onReady))
    fn(true, to);

  subs.set(fn, null);

  return () => subs.delete(fn);
}

function subscribe<T extends {}>(value: T, argument: OnUpdate){
  const listeners = LISTENER.get(value);

  if(listeners){
    LISTENER.set(value = Object.create(value), listeners);
    OBSERVER.set(value, argument);
  }

  return value;
}

function watch(from: any, key?: unknown, value?: any){
  const listeners = LISTENER.get(from)!;
  const observer = OBSERVER.get(from);

  if(observer){
    listeners.set(observer, 1 in arguments
      ? new Set(listeners.get(observer)).add(key)
      : null
    );
  
    if(value)
      return subscribe(value, observer);
  }

  return value;
}

function event(source: {}, key: unknown | boolean | null){
  LISTENER.get(source)!.forEach((select, callback, subs) => {
    let after;

    if(!select || select.has(key as string))
      if(after = callback.call(source, key, source))
        queue(after);

    if(after === null || key === null)
      subs.delete(callback);
  });
}

function queue(event: Callback){
  const { update, didUpdate } = LIFECYCLE;

  if(!DISPATCH.size)
    setTimeout(() => {
      update.forEach(x => x());
      DISPATCH.forEach(event => {
        try {
          event();
        }
        catch(err){
          console.error(err);
        }
      });
      DISPATCH.clear();
      didUpdate.forEach(x => x());
    }, 0);

  DISPATCH.add(event);
}

function effect<T extends {}>(
  target: T,
  callback: (this: T, argument: T) => Callback | Promise<void> | null | void){

  let refresh: (() => void) | null | undefined;
  let unSet: Callback | false | undefined;

  function invoke(){
    try {
      const out = callback.call(target, target);

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

  target = subscribe(target, () => {
    if(refresh && unSet){
      unSet();
      unSet = undefined;
    }
    return refresh;
  });

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
  queue,
  LIFECYCLE
}