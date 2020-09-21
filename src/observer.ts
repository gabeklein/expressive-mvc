import { ReferenceProperty } from './components';
import { Controller } from './controller';
import { lifecycleEvents } from './lifecycle';
import { Subscription } from './subscription';
import { entriesIn, isFn, Issues, within } from './util';

const FLAG_FIRST_COMPUTE = Symbol("is_initial");
const define = Object.defineProperty;

const Oops = Issues({
  NotTracked: (name) => 
    `Can't watch property ${name}, it's not tracked on this instance.`,

  IsComputed: (name) => 
    `Cannot set ${name} on this controller, it is computed.`,

  ComputeFailed: (parent, property) =>
    `There was an attempt to access computed property ` + 
    `${parent}.${property} for the first time; however an ` +
    `exception was thrown. Dependant values probably don't exist yet.`,

  ComputedEarly: (property) => 
    `Note: Computed values are usually only calculated after first ` +
    `access, except where accessed implicitly by "on" or "export". Your ` + 
    `'${property}' getter may have run earlier than intended because of that.`
})

type HandleUpdatedValues =
  (observed: {}, updated: string[]) => void;

type HandleUpdatedValue
  <T extends object = any, P extends keyof T = any> = 
  (this: T, value: T[P], changed: P) => void;

export interface Emitter {
  on(key: string | string[], listener: HandleUpdatedValue<this, any>): Callback;
  
  once(target: string, listener: HandleUpdatedValue<this, any>): void;
  once(target: string): Promise<any> | undefined;

  watch<P extends keyof this>(property: P, listener: HandleUpdatedValue<this, P>, once?: boolean): () => void;
  watch<P extends keyof this>(properties: P[], listener: HandleUpdatedValue<this, P>, once?: boolean): () => void;
}

export class Observer implements Emitter {
  constructor(public subject: any){}
  
  protected state = {} as BunchOf<any>;
  protected subscribers = {} as BunchOf<Set<() => void>>
  protected pending?: Set<string>;

  public get values(){
    return Object.assign({}, this.state);
  }

  public get watched(){
    return Object.keys(this.subscribers);
  }

  public on(
    target: string,
    listener: HandleUpdatedValue){

    return this.watch(target, listener, false, false);
  }

  public once(
    target: string,
    listener?: HandleUpdatedValue){

    if(listener)
      this.watch(target, listener, true, false);
    else
      return new Promise(resolve => {
        this.watch(target, resolve, true, false)
      });
  }

  public pick(keys?: string[]){
    const acc = {} as BunchOf<any>;

    if(keys)
      for(const key of keys)
        acc[key] = within(this.subject, key);

    else {
      for(const [key, { value }] of entriesIn(this))
        if(value !== undefined)
          acc[key] = value;
      
      Object.assign(acc, this.values);
    }

    return acc;
  }

  public feed(
    keys: string[],
    observer: HandleUpdatedValues,
    fireInitial?: boolean){

    const pending = new Set<string>();

    const callback = () => {
      const acc = {} as any;

      for(const k of keys)
        acc[k] = this.state[k];

      observer.call(this.subject, acc, Array.from(pending));
      pending.clear();
    };

    const release = this.addMultipleListener(keys, (key) => {
      if(!pending.size)
        setTimeout(callback, 0);

      pending.add(key);
    });

    if(fireInitial)
      callback();

    return release;
  }

  public watch(
    watch: string | string[],
    handler: (value: any, key: string) => void,
    once?: boolean,
    ignoreUndefined?: boolean){

    if(typeof watch == "string")
      watch = [watch];

    const onUpdate = (key: string) => {
      if(once)
        release();
        
      handler.call(this.subject, this.state[key], key);
    }

    const release =
      this.addMultipleListener(watch, onUpdate, ignoreUndefined);

    return release;
  }

  protected manage(
    key: string,
    handler?: ((value: any) => any)){

    if(handler)
      define(this.subject, key, {
        enumerable: true,
        configurable: false,
        get: () => this.state[key],
        set: handler 
      })

    return this.subscribers[key] || (
      this.subscribers[key] = new Set()
    );
  }

  public monitorValues(ignore: any = {}){
    const entries = entriesIn(this.subject);

    for(const [key, desc] of entries){
      if(key in ignore)
        continue;

      if("value" in desc === false)
        continue;

      const val = desc.value;

      if(isFn(val) && !/^[A-Z]/.test(key))
        continue;

      if(val instanceof ReferenceProperty)
        this.monitorRef(key, val);
      else if(Controller.isTypeof(val))
        this.subject.attach(key, val);
      else
        this.monitorValue(key, val)
    }
  }

  public emit(...keys: string[]){
    if(this.pending)
      for(const x of keys)
        this.pending.add(x);
    else {
      const batch = this.pending = new Set(keys);
      setTimeout(() => {
        this.pending = undefined;
        this.emitSync(...batch);
      }, 0);
    }
  }

  protected emitSync(...keys: string[]){
    const queued = new Set<Callback>();

    for(const k of keys)
      for(const sub of this.subscribers[k] || [])
        queued.add(sub);

    for(const trigger of queued)
      trigger();
  }

  protected monitorRef(
    key: string, ref: ReferenceProperty){
      
    const { subject } = this;
    const { handler } = ref;
    let current: any = null;
    let unSet: Callback | undefined;

    this.subscribers[key] = new Set();
    define(subject, key, {
      value: define({}, "current", {
        get: () => current,
        set: (value) => {
          if(isFn(unSet))
            unSet();
          if(isFn(handler))
            unSet = handler.call(subject, value);
            
          this.state[key] = current = value;
          this.emit(key);
        }
      })
    })
  }
  
  protected monitorValue(key: string, initial: any){
    this.state[key] = initial;

    this.manage(key, (value: any) => {
      if(this.state[key] === value)
        if(!Array.isArray(value))
          return;
        
      this.state[key] = value;
      this.emit(key);
    })
  }

  public monitorComputed(Ignore?: Class){
    const { subscribers, subject } = this;
    
    const getters = {} as BunchOf<() => any>;
    let search = subject;

    while(
      search !== Ignore &&
      search.constructor !== Ignore
    ){
      const entries = entriesIn(search);

      for(const [key, item] of entries)
        if(key == "constructor" || key in this.state || key in getters)
          continue;
        else if(item.get)
          getters[key] = item.get;

      search = Object.getPrototypeOf(search)
    }

    for(const key in getters){
      const compute = getters[key];
      subscribers[key] = new Set();

      define(subject, key, {
        configurable: true,
        set: Oops.NotTracked(key).throw,
        get: this.monitorComputedValue(key, compute)
      })
    }
  }

  protected monitorComputedValue(key: string, fn: () => any){
    const { state, subscribers, subject } = this;

    subscribers[key] = new Set();

    const onValueDidChange = () => {
      const value = fn.call(subject);

      if(state[key] !== value){
        state[key] = value;
        this.emitSync(key);
      }
    }

    const getStartingValue = (early?: boolean) => {
      try {
        const sub = new Subscription(this, onValueDidChange);
        const value = state[key] = fn.call(sub.proxy);
        sub.commit();
        return value;
      }
      catch(e){
        this.computedDidFail(key, early);
        throw e;
      }
      finally {
        define(subject, key, {
          set: Oops.NotTracked(key).throw,
          get: () => state[key],
          enumerable: true,
          configurable: true
        })
      }
    }

    within(getStartingValue, FLAG_FIRST_COMPUTE, true);

    return getStartingValue;
  }

  protected computedDidFail(
    key: string,
    early?: boolean){

    const parent = this.subject.constructor.name;

    Oops.ComputeFailed(parent, key).warn();

    if(early)
      Oops.ComputedEarly(key).warn();
  };

  public addListener(
    key: string,
    callback: Callback){

    let register = this.manage(key);

    register.add(callback);

    return () =>
      register.delete(callback);
  }

  public addMultipleListener(
    keys: string[],
    callback: (didUpdate: string) => void,
    ignoreUndefined = true){

    let clear: Function[] = [];

    for(const key of keys){
      let listeners = this.subscribers[key];

      if(!listeners)
        if(lifecycleEvents.indexOf(key) >= 0)
          listeners = this.manage(key);
        else if(ignoreUndefined){
          this.monitorValue(key, undefined);
          listeners = this.subscribers[key];
        }
        else
          throw Oops.NotTracked(key);

      const trigger = () => callback(key);
      const descriptor = Object.getOwnPropertyDescriptor(this.subject, key);
      const getter = descriptor && descriptor.get;

      if(getter && FLAG_FIRST_COMPUTE in getter)
        (<any>getter)(true);

      listeners.add(trigger);
      clear.push(() => listeners.delete(trigger));
    }

    return () => {
      clear.forEach(x => x());
      clear = [];
    };
  } 
}