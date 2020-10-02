import { Placeholder } from './directives';
import { Subscription } from './subscription';
import { entriesIn, isFn, Issues, listAccess, within } from './util';

const FIRST_COMPUTE = Symbol("is_initial");
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
    `'${property}' getter may have run earlier than intended because of that.`,

  BadReturn: () =>
    `Callback for property-update may only return a function.`
})

export class Observer {
  constructor(public subject: any){}
  
  protected pending?: Set<string>;
  protected state = {} as BunchOf<any>;
  protected subscribers = {} as BunchOf<Set<() => void>>;

  public get values(){
    return Object.assign({}, this.state);
  }

  public get watched(){
    return Object.keys(this.subscribers);
  }

  public on = (
    key: string | Selector,
    listener: HandleUpdatedValue) => {

    return this.watch(key, listener, false);
  }

  public once = (
    key: string | Selector,
    listener?: HandleUpdatedValue) => {

    if(listener)
      return this.watch(key, listener, true);
    else
      return new Promise(resolve =>
        this.watch(key, resolve, true)
      );
  }

  public effect = (
    callback: EffectCallback,
    select: string[] | Selector) => {
      
    let unSet: Callback | undefined;

    if(isFn(select))
      select = listAccess(this.watched, select);

    return this.addMultipleListener(select, () => {
      unSet && unSet();
      unSet = callback.call(this.subject);

      if(!isFn(unSet) && unSet)
        throw Oops.BadReturn()
    })
  }

  public export = (
    select?: string[] | Selector) => {

    if(!select)
      return { ...this.values };

    const acc = {} as BunchOf<any>;

    if(isFn(select))
      select = listAccess(this.watched, select);
    
    for(const key of select)
      acc[key] = within(this.subject, key);

    return acc;
  }

  public update = (
    select: string | string[] | Selector | BunchOf<any>,
    ...rest: string[]) => {

    if(typeof select == "string")
      select = [select].concat(rest);

    else if(isFn(select))
      select = listAccess(this.watched, select as any);

    if(Array.isArray(select))
      select.forEach(k => this.emit(k))

    else
      for(const key in select)
        this.set(key, select[key]);
  }

  public set(key: string, value: any){
    let set = this.state;

    if(!(key in this.subscribers))
      set = this.subject;

    if(set[key] === value)
      return false;
    else
      set[key] = value;

    this.emit(key);
    return true;
  }

  public addListener(
    key: string,
    callback: Callback,
    once?: boolean){

    const listeners = this.manage(key);
    const stop = () => { listeners.delete(callback) };
    const onUpdate = once
      ? () => { stop(); callback() }
      : callback;

    const desc = Object.getOwnPropertyDescriptor(this.subject, key);
    const getter = desc && desc.get;
    if(getter && FIRST_COMPUTE in getter)
      (getter as Function)(true);

    listeners.add(onUpdate);
    return stop;
  }

  public addMultipleListener(
    keys: string[],
    callback: (didUpdate: string) => void){

    const cleanup = keys.map(k => 
      this.addListener(k, () => callback(k))
    )

    return () => cleanup.forEach(x => x());
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

  public emitSync(...keys: string[]){
    const queued = new Set<Callback>();

    for(const k of keys)
      for(const sub of this.subscribers[k] || [])
        queued.add(sub);

    for(const trigger of queued)
      trigger();
  }

  public watch(
    key: string | Selector,
    handler: (value: any, key: string) => void,
    once?: boolean){

    if(isFn(key))
      key = listAccess(this.watched, key)[0];

    const callback = () =>
      handler.call(
        this.subject, 
        this.state[key as string],
        key as string
      );

    return this.addListener(key, callback, once);
  }

  public accessor(
    key: string,
    callback?: EffectCallback){

    let unSet: Callback | undefined;
      
    this.manage(key);
    return {
      get: () => this.state[key],
      set: (value: any) => {
        if(!this.set(key, value) || !callback)
          return;
  
        unSet && unSet();
        unSet = callback.call(this.subject, value);
  
        if(!isFn(unSet) && unSet)
          throw Oops.BadReturn()
      }
    }
  }

  protected manage(key: string){
    return this.subscribers[key] || (
      this.subscribers[key] = new Set()
    );
  }

  public monitorValues(ignore: any = {}){
    const entries = entriesIn(this.subject);

    for(const [key, desc] of entries){
      const { value } = desc;

      if(key in ignore
      || "value" in desc == false
      || isFn(value) && !/^[A-Z]/.test(key))
        continue;

      if(value instanceof Placeholder)
        value.applyTo(this, key);
      else
        this.monitorValue(key, value);
    }
  }

  protected monitorValue(
    key: string,
    initial: any){

    this.state[key] = initial;
    this.manage(key);

    define(this.subject, key, {
      enumerable: true,
      configurable: false,
      get: () => this.state[key],
      set: (value: any) => this.set(key, value)
    })
  }

  public monitorComputed(Ignore?: Class){
    const { subscribers, subject } = this;
    const getters = {} as BunchOf<() => any>;

    for(
      let sub = subject; 
      sub !== Ignore && sub.constructor !== Ignore;
      sub = Object.getPrototypeOf(sub)
    )
      for(const [key, item] of entriesIn(sub))
        if(!item.get
        || key == "constructor"
        || key in subscribers 
        || key in getters)
          continue;
        else 
          getters[key] = item.get;

    for(const key in getters)
      define(subject, key, {
        configurable: true,
        set: Oops.NotTracked(key).throw,
        get: this.monitorComputedValue(key, getters[key])
      })
  }

  protected monitorComputedValue(
    key: string,
    compute: () => any){

    const { state, subject } = this;

    this.manage(key);

    const recalculate = () => {
      const value = compute.call(subject);

      if(state[key] !== value){
        state[key] = value;
        this.emitSync(key);
      }
    }

    const getStartingValue = (early?: boolean) => {
      try {
        const sub = new Subscription(this, recalculate);
        const value = state[key] = compute.call(sub.proxy);
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

    within(getStartingValue, FIRST_COMPUTE, true);

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
}