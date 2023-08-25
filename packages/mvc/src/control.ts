import { Model } from './model';

const DISPATCH = new Set<Callback>();
const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Control.OnUpdate>();
const LISTENER = new WeakMap<{}, Map<Control.OnUpdate, Set<string> | undefined>>

declare namespace Control {
  type Getter<T> = (source: Model) => T;
  type Setter<T> = (value: T, previous: T) => boolean | void | (() => T);

  type Descriptor<T = any> = {
    get?: Getter<T>;
    set?: Setter<T> | false;
    enumerable?: boolean;
    value?: T;
  }

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

class Control<T extends {} = any> {
  public state!: { [property: string]: unknown };

  public frame: { [property: string]: unknown } = Object.freeze({});

  public listeners: Map<Control.OnUpdate, Set<string> | undefined> = new Map();

  constructor(public subject: T){
    REGISTER.set(subject, this);
    LISTENER.set(subject, this.listeners);
  }

  addListener(fn: Control.OnUpdate){
    this.listeners.set(fn, undefined);
    return () => {
      this.listeners.delete(fn);
    }
  }

  set(key: string, value?: unknown, intercept?: boolean | Control.Setter<any>){
    if(1 in arguments){
      const previous = this.state[key];
  
      if(value === previous)
        return true;
  
      if(typeof intercept == "function"){
        const result = intercept.call(this.subject, value, previous);
  
        if(result === false)
          return;
          
        if(typeof result == "function")
          value = result();
      }
  
      this.state[key] = value;
    }

    if(intercept === true)
      return;

    this.update(key);
  }

  update(key: string | boolean | null){
    let { frame } = this;

    if(typeof key == "string"){
      if(Object.isFrozen(frame)){
        frame = this.frame = {};
  
        queue(() => {
          this.update(false);
          Object.freeze(frame);
        })
      }

      if(key in frame)
        return;
  
      frame[key] = this.state[key];
    }

    this.listeners.forEach((only, cb, subs) => {
      if(!only || typeof key == "string" && only.has(key)){
        const after = cb(key, this.subject);
    
        if(after === null)
          subs.delete(cb);
        else if(after)
          queue(after);
      }
    });
  }

  watch(key: string, output: Control.Descriptor<any>){
    const { state, subject } = this;
    const { enumerable = true } = output;

    if("value" in output)
      state[key] = output.value;

    Object.defineProperty(subject, key, {
      enumerable,
      set: (next) => {
        if(output.set === false)
          throw new Error(`${subject}.${key} is read-only.`);

        this.set(key, next, output.set);
      },
      get(){
        const value = output.get ? output.get(this) : state[key];

        return observe(this, key, value);
      }
    });
  }

  next(
    arg1?: number | Model.Event,
    arg2?: (key: string) => boolean | void
  ){
    if(typeof arg1 == "function")
      return this.addListener(key => {
        if(typeof key == "string")
          return arg1(key)
      })

    return new Promise<any>((resolve, reject) => {
      if(typeof arg1 != "number" && Object.isFrozen(this.frame)){
        resolve(false);
        return;
      }
  
      const callback = () => resolve(this.frame);
      const remove = this.addListener((key) => {
        if(key === true || arg2 && typeof key == "string" && arg2(key) !== true)
          return;
  
        if(timeout)
          clearTimeout(timeout);
  
        remove();
  
        return callback;
      });
  
      const timeout = typeof arg1 == "number" && setTimeout(() => {
        remove();
        reject(arg1);
      }, arg1);
    });
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

function control<T extends Model>(subject: T, ready?: boolean){
  const self = REGISTER.get(subject.is) as Control<T>;
  const subs = self.listeners;

  if(ready && !self.state){
    self.state = {};
    self.update(true);
  }

  if(ready === false){
    Object.freeze(self.state);
    self.update(null);
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

  const self = control(target);
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

  if(self.state)
    invoke();

  self.addListener(key => {
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
  control,
  Control,
  effect,
  LIFECYCLE
}