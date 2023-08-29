import { Model } from './model';

const READY = new WeakSet<Control>();
const DISPATCH = new Set<Callback>();
const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Control.OnUpdate>();
const LISTENER = new WeakMap<{}, Map<Control.OnUpdate, Set<string> | undefined>>;
const INSTRUCT = new Map<symbol, Model.Instruction>();

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

class Control<T extends Model = any> {
  public state: { [property: string]: unknown } = {};

  public frame: { [property: string]: unknown } = Object.freeze({});

  constructor(public subject: T){
    REGISTER.set(subject, this);
    LISTENER.set(subject, new Map());
  }

  addListener(fn: Control.OnUpdate){
    const subs = LISTENER.get(this.subject)!;

    if(READY.has(this))
      fn(true, this.subject);

    subs.set(fn, undefined);
    return () => {
      subs.delete(fn);
    }
  }

  get(property: string, required?: boolean){
    const { subject, state } = this;
    
    if(property in state || required === false){
      const value = state[property];

      if(value !== undefined || !required)
        return value;
    }

    const error = new Error(`${subject}.${property} is not yet available.`);
    const promise = new Promise<void>((resolve, reject) => {
      function release(){
        remove();
        resolve();
      }
  
      const remove = this.addListener(key => {
        if(key === property)
          return release;
  
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

  set(
    key: string | boolean | null,
    value?: unknown,
    silent?: boolean){

    let { frame, state, subject } = this;

    if(typeof key == "string"){
      if(1 in arguments){
        const previous = state[key];

        if(value === previous)
          return true;
    
        state[key] = value;
  
        if(silent === true)
          return;
      }

      if(Object.isFrozen(frame)){
        frame = this.frame = {};
  
        queue(() => {
          update(subject, false);
          Object.freeze(frame);
        })
      }

      const pending = key in frame;
  
      frame[key] = state[key];

      if(pending)
        return;
    }

    update(subject, key);
  }

  init(){
    const { state, subject } = this;

    for(const key in subject){
      const { value } = Object.getOwnPropertyDescriptor(subject, key)!;
      const instruction = INSTRUCT.get(value);
      let desc: Control.Descriptor = { value };

      if(instruction){
        INSTRUCT.delete(value);
        delete subject[key];

        const output = instruction.call(this, key, this);

        if(!output)
          continue;

        desc = typeof output == "function" ? { get: output } : output;
      }

      const { enumerable = true } = desc;

      if("value" in desc)
        state[key] = desc.value;

      Object.defineProperty(subject, key, {
        enumerable,
        set: (next) => {
          let { set } = desc;

          if(set === false)
            throw new Error(`${subject}.${key} is read-only.`);

          if(typeof set == "function"){
            const result = set.call(subject, next, state[key]);
      
            if(result === false)
              return;
              
            if(typeof result == "function")
              next = result();

            set = undefined;
          }

          this.set(key, next, set);
        },
        get(){
          const value = desc.get ? desc.get(this) : state[key];

          return observe(this, key, value);
        }
      });
    }
  }
}

function add<T = any>(instruction: Model.Instruction<T>){
  const placeholder = Symbol("instruction");
  INSTRUCT.set(placeholder, instruction);
  return placeholder as unknown as T;
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

  if(ready && !READY.has(self)){
    READY.add(self);
    self.init();
    update(subject, true);
  }

  if(ready === false){
    Object.freeze(self.state);
    update(subject, null);
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

function update(from: {}, key: string | boolean | null){
  LISTENER.get(from)!.forEach((select, callback, subs) => {
    if(!select || typeof key == "string" && select.has(key)){
      const after = callback(key, from);
  
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
  add,
  control,
  Control,
  effect,
  observe,
  LIFECYCLE
}