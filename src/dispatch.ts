import { Controller } from './controller';
import { PeerController } from './global';
import { ControlledInput, ControlledValue } from './hoc';
import { useSubscriber } from './subscriber';
import { createSubscription, SUBSCRIBE, UpdateTrigger } from './subscription';
import { BunchOf, Callback } from './types';
import { collectGetters, define, defineOnAccess, entriesOf, Set } from './util';
import { useWatchedProperty, useWatcher } from './watcher';

declare const setTimeout: (callback: Callback, ms: number) => number;

const { 
  assign,
  defineProperty,
  getOwnPropertyDescriptor,
} = Object;

export const DISPATCH = Symbol("controller_dispatch");

export type UpdateEventHandler = (value: any, key: string) => void;
export type UpdatesEventHandler = (observed: {}, updated: string[]) => void;

function simpleIntegrateExternal(
  this: Controller, a: string | BunchOf<any>, b?: BunchOf<any>){

  if(typeof a == "string")
    return (this as any)[a] = b
  else
    return assign(this, a)
}

export function tapControlled(
  this: Controller, key?: string, required?: boolean){

  return key ? 
    useWatchedProperty(this, key, required) : 
    useWatcher(this);
}

export function subControlled(
  this: Controller, ...args: any[]){

  return useSubscriber(this, args, true) 
}

export class ManagedProperty {
  constructor(
    public type: {} | (new (...args: any[]) => any),
    public create: () => {},
    public initial?: {}
  ){}
}

export function declareControlled(model: any, initial?: {}){
  const create = 
    typeof model == "function" ?
      "prototype" in model ?
        () => new model() :
        () => model() :
    typeof model == "object" ?
      () => assign({}, model) :
      null;

  if(!create){
    //todo: detect class attempted to init via stack trace.
    throw new Error(`Managing property ${model} is not possible as it can't be converted to an object.`)
  }

  return new ManagedProperty(model, create, initial);
}

export class Dispatch {
  current: BunchOf<any> = {};
  subscribers: BunchOf<Set<UpdateTrigger>> = {};
  pendingUpdates = new Set<string>();
  pendingRefresh = false;

  constructor(
    public control: Controller
  ){}

  static readyFor(control: any){
    if(DISPATCH in control)
      return;

    const dispatch = new this(control);

    dispatch.initObservable();
    define(control, DISPATCH, dispatch);
    define(control, {
      get: control,
      set: control,
      tap: tapControlled,
      sub: subControlled,
      assign: simpleIntegrateExternal,
      onChange: dispatch.onChange,
      observe: dispatch.observe,
      export: dispatch.export,
      toggle: dispatch.toggle,
      refresh: dispatch.refresh
    })
    defineOnAccess(control, "Value", ControlledValue)
    defineOnAccess(control, "Input", ControlledInput)

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
      return this.collect(subset)
  }

  onChange = (
    key: string | string[], 
    listener?: (changed: string[]) => void) => {
  
    if(listener)
      this.observe(key as any, listener, true);
    else {
      return new Promise(resolve => {
        this.observe(key as any, resolve, true);
      })
    }
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
      const getter = getOwnPropertyDescriptor(this.control, key)?.get;

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
  
  private collect(keys?: string[]){
    const acc = {} as BunchOf<any>;

    if(keys){
      for(const key of keys)
        acc[key] = (this.control as any)[key]

      return acc;
    }

    for(const key in this){
      const desc = getOwnPropertyDescriptor(this, key);

      if(!desc) continue;

      if(desc.value !== undefined)
        acc[key] = desc.value;
    }
    for(const key in this.subscribers)
      acc[key] = this.current[key]

    return acc;
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

      const value = desc.value;

      if(typeof value === "function")
        continue;
        
      if(value instanceof PeerController){
        value.attachNowIfGlobal(control, key);
        continue;
      }

      subscribers[key] = new Set();

      defineProperty(control, key, {
        enumerable: true,
        configurable: false,
        get: () => current[key],
        set: value instanceof ManagedProperty 
          ? this.monitorManagedValue(key, value)
          : this.monitorValue(key, value)
      })
    }
  }

  private monitorValue(key: string, initial: any){
    this.current[key] = initial;

    return (value: any) => {
      if(this.current[key] === value) 
        return;
        
      this.current[key] = value;
      this.pendingUpdates.add(key);
      this.update();
    }
  }
  
  private monitorManagedValue(key: string, { create, initial }: ManagedProperty){
    const { current } = this;

    function generate(value: {}){
      const saved = current[key] = create();
      assign(saved, value);
      Dispatch.readyFor(saved);
    }

    if(initial)
      generate(initial)
    else
      current[key] = undefined;

    return (value: any) => {
      if(!value)
        current[key] = undefined
      else if(typeof value == "object")
        generate(value)
      else
        throw new Error("Cannot assign a non-object to this property; it is managed.")
      
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