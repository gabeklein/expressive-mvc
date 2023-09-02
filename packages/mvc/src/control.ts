import { Model } from './model';

const READY = new WeakSet<Model>();
const DISPATCH = new Set<Callback>();
const OBSERVER = new WeakMap<{}, Control.OnUpdate>();
const LISTENER = new WeakMap<{}, Map<Control.OnUpdate, Set<string> | undefined>>;

declare namespace Control {
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
  type OnUpdate = (key: string | null | boolean, source: {}) => (() => void) | null | void;
}

const LIFECYCLE = {
  update: new Set<Callback>(),
  didUpdate: new Set<Callback>()
}

function addListener(to: Model, fn: Control.OnUpdate){
  let subs = LISTENER.get(to = to.is)!;

  if(!subs)
    LISTENER.set(to, subs =
      new Map().set(() => READY.add(to) && null, undefined)
    );

  if(READY.has(to as any))
    fn(true, to);

  subs.set(fn, undefined);
  return () => {
    subs.delete(fn);
  }
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

function watch<T extends {}>(value: T, argument: Control.OnUpdate){
  const listeners = LISTENER.get(value);

  if(listeners){
    LISTENER.set(value = Object.create(value), listeners);
    OBSERVER.set(value, argument);
  }

  return value;
}

function event(source: {}, key: string | boolean | null){
  LISTENER.get(source)!.forEach((select, callback, subs) => {
    let after;

    if(!select || typeof key == "string" && select.has(key))
      if(after = callback(key, source))
        queue(after);

    if(after === null || key === null)
      subs.delete(callback);
  });
}

function observe(from: any, key: string, value: any){
  const listeners = LISTENER.get(from);
  const observer = OBSERVER.get(from);

  if(!observer || !listeners)
    return value;
    
  listeners.set(observer, 
    new Set(listeners.get(observer)).add(key)
  );

  return watch(value, observer);
}

export {
  addListener,
  Control,
  event,
  observe,
  queue,
  LIFECYCLE,
  watch
}