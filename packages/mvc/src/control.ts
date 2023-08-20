import { Model } from './model';

const REGISTER = new WeakMap<{}, Control>();
const OBSERVER = new WeakMap<{}, Control.OnUpdate>();
const PARENTS = new WeakMap<Model, Model>();

declare namespace Control {
  /**
   * Property initializer, will run upon instance creation.
   * Optional returned callback will run when once upon first access.
   */
  type Instruction<T> = (this: Control, key: string, thisArg: Control) =>
    | PropertyDescriptor<T>
    | Getter<T>
    | void;

  type Getter<T> = (source: Model) => T;
  type Setter<T> = (value: T, previous: T) => boolean | void | (() => T);

  type PropertyDescriptor<T = any> = {
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
   *    - `string` - property which has updated.
   *    - `true` - the initial event, instance is now ready.
   *    - `false` - update in-progress has completed.
   *    - `null` - model is marked for garbage collection.
   * 
   * @param source - Instance of Model for which update has occured.
   */
  type OnUpdate =
    (key: string | null | boolean, source: {}) => (() => void) | null | void;
}

const LIFECYCLE = {
  dispatch: new Set<Callback>(),
  update: new Set<Callback>(),
  didUpdate: new Set<Callback>(),
}

class Control<T extends {} = any> {
  static watch = watch;
  static for = control;

  static on(event: "update" | "didUpdate", callback: Callback): Callback {
    LIFECYCLE[event].add(callback);
    return () => LIFECYCLE[event].delete(callback);
  }

  public id: string;
  public subject: T;

  public state!: { [property: string]: unknown };
  public frame: { [property: string]: unknown } = Object.freeze({});

  public listeners: Map<Control.OnUpdate, Set<string> | undefined> = new Map();

  constructor(subject: T, id?: string | number | false){
    this.id = `${subject.constructor}-${id ? String(id) : uid()}`;
    this.subject = subject;

    REGISTER.set(subject, this);
  }

  addListener<T extends Model>(fn: Control.OnUpdate){
    this.listeners.set(fn, undefined);
    return () => {
      this.listeners.delete(fn);
    }
  }

  set(key: string, value: unknown, silent?: boolean){
    const { state } = this;

    if(value === state[key])
      return true;

    state[key] = value;

    if(!silent)
      this.update(key);
  }

  watch(key: string, output: Control.PropertyDescriptor<any>){
    const { state, subject, listeners } = this;
    const { set, enumerable = true } = output;

    if("value" in output)
      state[key] = output.value;

    Object.defineProperty(subject, key, {
      enumerable,
      set: set === false
        ? undefined
        : (next) => {
          const previous = state[key];
    
          if(next === previous)
            return;
          
          if(set){
            const result = set.call(subject, next, previous);

            if(result === false)
              return;
              
            if(typeof result == "function")
              next = result();
          }

          this.set(key, next);
        },
      get(this: Model){
        const value = output.get
          ? output.get(this)
          : state[key];

        const observer = OBSERVER.get(this);

        if(observer){
          const keys = new Set(listeners.get(observer));
          listeners.set(observer, keys.add(key));
          return watch(value, observer)
        }

        return value;
      }
    });
  }

  update(key: string){
    let { frame, listeners, state, subject } = this; 

    function push(key: string | boolean){
      listeners.forEach((only, cb, subs) => {
        if(!only || only.has(key as string)){
          const after = cb(key, subject);
      
          if(after === null)
            subs.delete(cb);
          else if(after)
            queue(after);
        }
      });
    }

    if(Object.isFrozen(frame)){
      frame = this.frame = {};

      queue(() => {
        Object.freeze(frame);
        push(false);
      })
    }

    if(key in frame)
      return;

    frame[key] = state[key];
    push(key);
  }
}

function control<T extends Model>(subject: T, ready?: boolean){
  const self = REGISTER.get(subject.is) as Control<T>;
  const subs = self.listeners;

  if(ready !== undefined && !self.state){
    self.state = {};
    subs.forEach((_, fn) => fn(true, self));
  }

  if(ready === false){
    Object.freeze(self.state);
    subs.forEach((_, fn) => fn(null, self));
    subs.clear();
  }

  return self;
}

function queue(event: Callback){
  const { update, didUpdate, dispatch } = LIFECYCLE;

  if(!dispatch.size)
    setTimeout(() => {
      update.forEach(x => x());
      dispatch.forEach(event => {
        try {
          event();
        }
        catch(err){
          console.error(err);
        }
      });
      dispatch.clear();
      didUpdate.forEach(x => x());
    }, 0);

  dispatch.add(event);
}

function parent(from: unknown, assign?: {}){
  if(!assign)
    return PARENTS.get(from as Model);

  PARENTS.set(from as Model, assign as Model);
}

function watch<T extends {}>(value: T, argument: Control.OnUpdate){
  const control = REGISTER.get(value);

  if(control){
    if(!OBSERVER.has(value))
      REGISTER.set(value = Object.create(value), control);
  
    OBSERVER.set(value, argument);
  }

  return value;
}

/** Random alphanumberic of length 6. Will always start with a letter. */
function uid(){
  return (Math.random() * 0.722 + 0.278).toString(36).substring(2, 8).toUpperCase();
}

export {
  control,
  Control,
  parent,
  uid,
  watch
}