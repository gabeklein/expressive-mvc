import { Controller } from './controller';
import { createSubscription, SUBSCRIBE, UpdateTrigger } from './subscription';
import { BunchOf, Callback } from './types';
import { collectGetters, define, entriesOf, Set } from './util';

declare const setTimeout: (callback: Callback, ms: number) => number;

const { 
  assign: assignTo,
  defineProperty,
  getOwnPropertyDescriptor: describe,
} = Object;

export const DISPATCH = Symbol("controller_dispatch");

export type UpdateEventHandler = (value: any, key: string) => void;
export type UpdatesEventHandler = (observed: {}, updated: string[]) => void;

function simpleIntegrateExternal(
  this: Controller, a: string | BunchOf<any>, b?: BunchOf<any>){

  if(typeof a == "string")
    return (this as any)[a] = b
  else
    return assignTo(this, a)
}

export class ManagedProperty {
  constructor(public type: any){}
}

export function setControlledProperty(model: any){
  return new ManagedProperty(model);
}

export class Dispatch {
  current: BunchOf<any> = {};
  subscribers: BunchOf<Set<UpdateTrigger>> = {};
  pendingUpdates = new Set<string>();
  pendingRefresh = false;

  constructor(
    public control: Controller
  ){}

  static readyFor(control: Controller){
    if(DISPATCH in control)
      return;

    const dispatch = new this(control);

    dispatch.initObservable();
    define(control, DISPATCH, dispatch);
    define(control, <Controller>{
      get: control,
      set: control,
      assign: simpleIntegrateExternal,
      observe: dispatch.observe,
      export: dispatch.export,
      toggle: dispatch.toggle,
      refresh: dispatch.refresh
    })
    dispatch.initComputed();

    if(control.isReady)
      control.isReady();
  }

  toggle = (key: string) => {
    this.current[key] = !this.current[key];
    this.refresh(key)
  }
  
  refresh = (...watching: string[]) => {
    for(const x of watching)
      this.pendingUpdates.add(x)
      
    this.update();
  }

  export = (
    subset?: string[] | Callback, 
    onChange?: Callback | boolean,
    initial?: boolean) => {

    if(typeof subset == "function"){
      initial = onChange as boolean;
      onChange = subset;
      subset = Object.keys(this.subscribers);
    }

    if(typeof onChange == "function")
      return this.watch(subset!, onChange, initial)
    else 
      return this.get(subset)
  }
  
  observe = (
    watch: string | string[], 
    handler: UpdateEventHandler,
    once?: boolean) => {

    if(typeof watch == "string")
      watch = [watch];

    const onDone = 
      this.addMultiListener(watch, (key) => {
        if(once) onDone();
        handler.apply(this.control, [this.current[key], key]) 
      })

    return onDone;
  }

  public addListener(
    key: string, callback: UpdateTrigger){

    let register = this.subscribers[key];

    if(!register)
      register = this.subscribers[key] = new Set();

    register.add(callback);

    return () => register.delete(callback);
  }
  
  private get(keys?: string[]){
    const acc = {} as BunchOf<any>;
    const { current } = this;

    if(keys){
      for(const key of keys){
        let desc = describe(this, key);

        acc[key] = 
          desc && 
          desc.value || 
          current[key]
      }

      return acc;
    }

    for(const key in this){
      const desc = describe(this, key);

      if(!desc) continue;

      if(desc.value !== undefined)
        acc[key] = desc.value;
    }
    for(const key in current)
      acc[key] = current[key]

    return acc;
  }

  private addMultiListener(
    onProperyNames: string[], 
    callback: (didUpdate: string) => void){

    let clear: Function[] = [];

    for(const key of onProperyNames){
      const listeners = this.subscribers[key];
  
      if(!listeners)
        throw new Error(
          `Can't watch property ${key}, it's not tracked on this instance.`
        )

      const trigger = () => callback(key);
      const getter = describe(this.control, key)?.get;

      if(getter?.name == "initComputedValue"){
        const initialize = getter as (early?: true) => unknown;
        initialize(true);
      }

      listeners.add(trigger);
      clear.push(() => listeners.delete(trigger))
    }

    return () => {
      clear.forEach(x => x());
      clear = [];
    };
  }

  private watch(
    keys: string[], 
    observer: UpdatesEventHandler,
    fireInitial?: boolean){

    const pending = new Set<string>();

    const callback = () => {
      const acc = {} as any;

      for(const k of keys)
        acc[k] = this.current[k];

      observer.apply(this.control, [acc, Array.from(pending)])
      pending.clear();
    }

    const onDone = 
      this.addMultiListener(keys, (key) => {
        if(!pending.length)
          setTimeout(callback, 0)
        pending.add(key);
      })

    if(fireInitial)
      callback()

    return onDone;
  }

  private update(){
    if(this.pendingRefresh)
      return;
    else
      this.pendingRefresh = true;

    setTimeout(() => {
      const queued = new Set<UpdateTrigger>();
      const { pendingUpdates, subscribers } = this;

      for(const key of pendingUpdates)
        for(const sub of subscribers[key] || [])
          queued.add(sub);

      for(const onDidUpdate of queued)
        onDidUpdate();

      pendingUpdates.clear();
      this.pendingRefresh = false;
    }, 0)
  }

  private initObservable(){
    const { current, control, subscribers } = this;

    for(const [key, desc] of entriesOf(control)){
      if("value" in desc === false)
        continue;

      if(typeof desc.value === "function")
        continue;

      const value = current[key] = desc.value;
      subscribers[key] = new Set();

      defineProperty(control, key, {
        enumerable: true,
        configurable: false,
        get: () => current[key],
        set: value instanceof ManagedProperty 
          ? this.monitorManagedValue(key, value)
          : this.monitorValue(key)
      })
    }
  }

  private monitorValue(key: string){
    return (value: any) => {
      if(this.current[key] === value) 
        return;
        
      this.current[key] = value;
      this.pendingUpdates.add(key);
      this.update();
    }
  }
  
  private monitorManagedValue(key: string, managed: ManagedProperty){
    const { current } = this;
    const { type } = managed;
    const create = () => {
      if(typeof type == "function")
        if("prototype" in type)
          return new type()
        else 
          return assignTo({}, type);
      else 
        throw new Error()
    }

    return (value: unknown) => {
      let saved = current[key];

      if(value === undefined)
        current[key] = undefined

      else if(value === null || typeof value !== "object")
        throw new Error("Cannot assign non-object to this property; it is managed.")

      else {
        saved = current[key] = create();
        Dispatch.readyFor(saved);
        assignTo(saved, value);
      }
      
      this.pendingUpdates.add(key);
      this.update();
    }
  }

  private initComputed(){
    const { current, subscribers, control } = this;
    const getters = collectGetters(control, ["Provider", "Input", "Value"]);

    for(const [key, fn] of Object.entries(getters)){
      subscribers[key] = new Set();

      const getValueLazy = () => current[key];

      const setNotAllowed = () => {
        throw new Error(`Cannot set ${key} on this controller, it is computed.`) 
      }
  
      const onValueDidChange = () => {
        const value = fn.call(control);
        const subscribed = subscribers[key] || [];
  
        if(current[key] === value)
          return
  
        current[key] = value;
        this.pendingUpdates.add(key);

        for(const onDidUpdate of subscribed)
          onDidUpdate();
      }

      function initComputedValue(early?: true){
        try {
          const spy = createSubscription(control, onValueDidChange);
          const value = current[key] = fn.call(spy);
          spy[SUBSCRIBE]!();
          return value;
        }
        catch(err){
          const entity = control.constructor.name;
          let warning = 
            `There was an attempt to access computed property ${entity}.${key} for the first time; ` +
            `however an exception was thrown. Expected data probably doesn't exist yet.`;

          if(early)
            warning += `\n` + 
              `Note: Computed are usually only calculated when first accessed, except when forced by "observe" or "export".` +
              `This property's getter may have run earlier than intended because of that.`

          console.warn(warning);
          throw err;
        }
        finally {
          defineProperty(control, key, {
            set: setNotAllowed,
            get: getValueLazy,
            enumerable: true,
            configurable: true
          })
        }
      }
  
      defineProperty(control, key, {
        set: setNotAllowed,
        get: initComputedValue,
        configurable: true
      })
    }
  }
}