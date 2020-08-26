import { lifecycleEvents } from './lifecycle';
import { Subscription } from './subscription';
import { collectGetters, Issues } from './util';

const Oops = Issues({
  NotTracked: (name) => 
    `Can't watch property ${name}, it's not tracked on this instance.`,

  IsComputed: (name) => 
    `Cannot set ${name} on this controller, it is computed.`
})

type UpdateEventHandler = 
  (value: any, key: string) => void;

type HandleUpdatedValue
  <T extends object, P extends keyof T> = 
  (this: T, value: T[P], changed: P) => void

export const OBSERVER = Symbol("object_observer");

export interface Observable {
  [OBSERVER]: Observer<any>;

  on(key: string | string[], listener: HandleUpdatedValue<this, any>): Callback;
  
  once(target: string, listener: HandleUpdatedValue<this, any>): void;
  once(target: string): Promise<any> | undefined;

  refresh(...keys: string[]): void;

  observe<P extends keyof this>(
    key: P | P[], 
    listener: HandleUpdatedValue<this, P>, 
    once?: boolean
  ): Callback;
}

export class Observer<T extends Observable> {
  constructor(public subject: T){}
  
  protected state = {} as BunchOf<any>;
  protected pending = new Set<string>();
  protected subscribers = {} as BunchOf<Set<() => void>>

  public get values(){
    return Object.assign({}, this.state);
  }

  public get managed(){
    return Object.keys(this.subscribers);
  }

  public on(
    target: string,
    listener: HandleUpdatedValue<any, any>){

    return this.watch(target, listener, false, false);
  }

  public once(
    target: string,
    listener?: HandleUpdatedValue<any, any>){
      
    if(listener)
      this.watch(target, listener, true, false);
    else
      return new Promise(resolve => {
        this.watch(target, resolve, true, false);
      });
  }

  public watch(
    watch: string | string[],
    handler: UpdateEventHandler,
    once?: boolean,
    ignoreUndefined?: boolean){

    if(typeof watch == "string")
      watch = [watch];

    const onUpdate = (key: string) => {
      if(once)
        unsubscribe();
        
      handler.call(this.subject, this.state[key], key);
    }

    //TODO: dont use multi-listener by default
    const unsubscribe =
      this.addMultipleListener(watch, onUpdate, ignoreUndefined);

    return unsubscribe;
  }

  public trigger(...keys: string[]){
    for(const x of keys)
      this.pending.add(x)
      
    this.update();
  }

  protected manage(
    key: string,
    handler?: ((value: any) => any)){

    if(handler)
      Object.defineProperty(this.subject, key, {
        enumerable: true,
        configurable: false,
        get: () => this.state[key],
        set: handler 
      })

    return this.subscribers[key] || (
      this.subscribers[key] = new Set()
    );
  }

  //TODO: implement specify argument or true for all
  public monitorValues(except?: string[]){
    const desc = Object.getOwnPropertyDescriptors(this.subject);
    const entries = Object.entries(desc);

    for(const [key, desc] of entries){
      if(except && except.indexOf(key) >= 0)
        continue;

      if("value" in desc === false)
        continue;

      if(typeof desc.value === "function" && /^[A-Z]/.test(key) == false)
        continue;

      this.monitorValue(key, desc.value)
    }
  }

  protected monitorValue(key: string, initial: any){
    this.state[key] = initial;

    this.manage(key, (value: any) => {
      if(this.state[key] === value)
        if(!Array.isArray(value))
          return;
        
      this.state[key] = value;
      this.pending.add(key);
      this.update();
    })
  }

  public monitorComputed(except?: string[]){
    const { subscribers, subject } = this;
    const getters = collectGetters(subject, except);

    for(const key in getters){
      const compute = getters[key];
      subscribers[key] = new Set();

      Object.defineProperty(subject, key, {
        configurable: true,
        set: Oops.NotTracked(key).throw,
        get: this.monitorComputedValue(key, compute)
      })
    }
  }

  protected monitorComputedValue(key: string, fn: () => any){
    const { state, subscribers, subject } = this;

    subscribers[key] = new Set();

    const getValueLazy = () => state[key];

    const onValueDidChange = () => {
      const value = fn.call(subject);
      const subscribed = subscribers[key] || [];

      if(state[key] === value)
        return

      state[key] = value;
      this.pending.add(key);

      for(const onDidUpdate of subscribed)
        onDidUpdate();
    }

    const getStartingValue = (early = false) => {
      try {
        const subscribe = new Subscription(subject, onValueDidChange);
        const value = state[key] = fn.call(subscribe.proxy);
        subscribe.start();
        return value;
      }
      catch(e){
        if(this.computedDidFail)
          this.computedDidFail(key, early);
        throw e;
      }
      finally {
        Object.defineProperty(subject, key, {
          set: Oops.NotTracked(key).throw,
          get: getValueLazy,
          enumerable: true,
          configurable: true
        })
      }
    }

    isInitialCompute(getStartingValue, true);

    return getStartingValue;
  }

  protected computedDidFail?(
    key: string, 
    early?: boolean
  ): void;

  protected update(){
    if(!this.pending.size)
      return;

    setTimeout(() => {
      const queued = new Set<Callback>();
      const { pending: pendingUpdate, subscribers } = this;

      for(const key of pendingUpdate)
        for(const sub of subscribers[key] || [])
          queued.add(sub);

      for(const onDidUpdate of queued)
        onDidUpdate();

      pendingUpdate.clear();
    }, 0);
  }

  //TODO: does this even have parity with multi?
  public addListener(
    key: string,
    callback: Callback){

    let register = this.manage(key);

    register.add(callback);

    return () => {
      register.delete(callback)
    }
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

      if(getter && isInitialCompute(getter))
        (getter as any)(true);

      listeners.add(trigger);
      clear.push(() => listeners.delete(trigger));
    }

    return () => {
      clear.forEach(x => x());
      clear = [];
    };
  } 
}

const isInitialCompute = (fn: any, set?: true) => {
  if(set)
    fn["initial"] = true;
  else 
    return fn["initial"];
}