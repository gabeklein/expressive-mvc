import { Model } from './model';

const DISPATCH = new Set<Callback>();
const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Control.OnUpdate>();

declare namespace Control {
  type Getter<T> = (source: Model) => T;
  type Setter<T> = (value: T, previous: T) => boolean | void | (() => T);

  type Descriptor<T = any> = {
    get?: Getter<T>;
    set?: Setter<T> | false;
    enumerable?: boolean;
    value?: T;
  }

  type Callback = (control: Control) => void;

  /**
   * Callback for Controller.for() static method.
   * Returned callback is forwarded.
   */
  type OnReady<T extends {}> = (control: Control<T>) => (() => void) | void;

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
  }

  addListener(fn: Control.OnUpdate){
    this.listeners.set(fn, undefined);
    return () => {
      this.listeners.delete(fn);
    }
  }

  set(key: string, value?: unknown, intercept?: boolean | Control.Setter<any>){
    const { state, subject } = this; 

    if(1 in arguments){
      const previous = state[key];
  
      if(value === previous)
        return true;
  
      if(typeof intercept == "function"){
        const result = intercept.call(subject, value, previous);
  
        if(result === false)
          return;
          
        if(typeof result == "function")
          value = result();
      }
  
      state[key] = value;
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
    const { state, subject, listeners } = this;
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
        const observer = OBSERVER.get(this);

        if(!observer)
          return value;
          
        listeners.set(observer, new Set(listeners.get(observer)).add(key));

        return watch(value, observer)
      }
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
  const self = REGISTER.get(subject) as Control<T>;
  const subs = self.listeners;

  if(ready !== undefined && !self.state){
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
  const control = REGISTER.get(value);

  if(control){
    REGISTER.set(value = Object.create(value), control);
    OBSERVER.set(value, argument);
  }

  return value;
}

export {
  control,
  Control,
  LIFECYCLE,
  watch
}