import { Model } from './model';

/**
 * Update callback function.
 * 
 * @param key - Specifies cause for update.
 *   - `string` - property which has updated.
 *   - `true` - the initial event, instance is now ready.
 *   - `false` - non-initial update has completed.
 *   - `null` - model is marked for garbage collection.
 * 
 * @param source - Instance of Model for which update has occured.
 */
type OnUpdate<T = any> = (
  this: T,
  key: string | null | boolean,
  source: T
) => (() => void) | null | void;

const DISPATCH = new Set<Callback>();
const OBSERVER = new WeakMap<{}, OnUpdate>();
const LISTENER = new WeakMap<{}, Map<OnUpdate, Set<string> | null>>;

const LIFECYCLE = {
  update: new Set<Callback>(),
  didUpdate: new Set<Callback>()
}

function onReady(this: Model){
  return null;
}

function addListener(to: Model, fn: OnUpdate){
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

function watch(from: any, key: string, value: any){
  const listeners = LISTENER.get(from)!;
  const observer = OBSERVER.get(from);

  if(!observer)
    return value;
    
  listeners.set(observer,
    new Set(listeners.get(observer)).add(key)
  );

  return subscribe(value, observer);
}

function event(source: {}, key: string | boolean | null){
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

export {
  addListener,
  event,
  watch,
  queue,
  LIFECYCLE,
  subscribe
}