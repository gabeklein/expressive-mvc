import { Model } from './model';

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

  update(
    key: string | boolean | null,
    value?: unknown,
    callback?: boolean | Control.Setter<any>){

    let { frame, state, subject } = this;

    if(typeof key == "string"){
      if(1 in arguments){
        const previous = state[key];
    
        if(typeof callback == "function"){
          const result = callback.call(subject, value, previous);
    
          if(result === false)
            return;
            
          if(typeof result == "function")
            value = result();
        }
    
        if(value === previous)
          return true;
    
        state[key] = value;
  
        if(callback === true)
          return;
      }

      if(Object.isFrozen(frame)){
        frame = this.frame = {};
  
        queue(() => {
          this.update(false);
          Object.freeze(frame);
        })
      }

      if(key in frame)
        return;
  
      frame[key] = state[key];
    }

    this.listeners.forEach((only, cb, subs) => {
      if(!only || typeof key == "string" && only.has(key)){
        const after = cb(key, subject);
    
        if(after === null)
          subs.delete(cb);
        else if(after)
          queue(after);
      }
    });
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
          if(desc.set === false)
            throw new Error(`${subject}.${key} is read-only.`);

          this.update(key, next, desc.set);
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
  add,
  control,
  Control,
  effect,
  observe,
  LIFECYCLE
}