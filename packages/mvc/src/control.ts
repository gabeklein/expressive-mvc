import { Model } from './model';

const READY = new WeakSet<Model>();
const DISPATCH = new Set<Callback>();
const REGISTER = new WeakMap<{}, Control>();
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

class Control<T extends Model = any> {
  public state: { [property: string]: unknown } = {};
  public frame: { [property: string]: unknown } = Object.freeze({});

  constructor(public subject: T){
    REGISTER.set(subject, this);
    LISTENER.set(subject, new Map());
  }
}

function addListener(to: Model, fn: Control.OnUpdate){
  to = to.is;

  const subs = LISTENER.get(to)!;

  if(READY.has(to as any))
    fn(true, to);

  subs.set(fn, undefined);
  return () => {
    subs.delete(fn);
  }
}

function fetch(subject: Model, property: string, required?: boolean){
  const { state } = control(subject);
  
  if(property in state || required === false){
    const value = state[property];

    if(value !== undefined || !required)
      return value;
  }

  const error = new Error(`${subject}.${property} is not yet available.`);
  const promise = new Promise<any>((resolve, reject) => {
    addListener(subject, key => {
      if(key === property){
        resolve(state[key]);
        return null;
      }

      if(key === null)
        reject(new Error(`${subject} is destroyed.`));
    });
  });

  throw Object.assign(promise, {
    toString: () => String(error),
    name: "Suspense",
    message: error.message,
    stack: error.stack
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

function control<T extends Model>(subject: T, ready?: boolean){
  subject = subject.is;

  const self = REGISTER.get(subject) as Control<T>;
  const subs = LISTENER.get(subject)!;

  if(ready && !READY.has(subject)){
    READY.add(subject);
    event(subject, true);
  }

  if(ready === false){
    Object.freeze(self.state);
    event(subject, null);
    subs.clear();
  }

  return self;
}

function watch<T extends {}>(value: T, argument: Control.OnUpdate){
  const listeners = LISTENER.get(value);

  if(listeners){
    LISTENER.set(value = Object.create(value), listeners);
    OBSERVER.set(value, argument);
  }

  return value;
}

function update(
  subject: Model,
  key: string | boolean | null,
  value?: unknown,
  silent?: boolean){

  const self = REGISTER.get(subject)!;
  let { frame, state } = self;

  if(typeof key == "string"){
    if(2 in arguments){
      const previous = state[key];

      if(value === previous)
        return true;
  
      state[key] = value;

      if(silent === true)
        return;
    }

    if(Object.isFrozen(frame)){
      frame = self.frame = {};

      queue(() => {
        event(subject, false);
        Object.freeze(frame);
      })
    }

    const pending = key in frame;

    frame[key] = state[key];

    if(pending)
      return;
  }

  event(subject, key);
}

function event(source: {}, key: string | boolean | null){
  LISTENER.get(source)!.forEach((select, callback, subs) => {
    if(!select || typeof key == "string" && select.has(key)){
      const after = callback(key, source);
  
      if(after === null)
        subs.delete(callback);
      else if(after)
        queue(after);
    }
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

function effect<T extends Model>(
  target: T,
  callback: Model.Effect<T>){

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

  target = watch(target, () => {
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
  fetch,
  control,
  Control,
  effect,
  observe,
  update,
  LIFECYCLE
}