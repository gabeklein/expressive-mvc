import { Controller } from './controller';
import { createSubscription } from './subscriber';
import { BunchOf, ModelController, SUBSCRIBE, UpdateTrigger } from './types';
import { define, entriesOf, Set } from './util';

declare const setTimeout: (callback: () => void, ms: number) => number;

export type UpdateEventHandler = (value: any, key: string) => void;
export type UpdatesEventHandler = (observed: {}, updated: string[]) => void;

const { 
  defineProperty,
  entries,
  getOwnPropertyDescriptor: describe,
  getOwnPropertyNames: keysOf,
  getPrototypeOf
} = Object;

const { random } = Math;

export class Dispatch {
  current: BunchOf<any> = {};
  subscribers: BunchOf<Set<UpdateTrigger>> = {};
  pendingUpdates = new Set<string>();
  pendingRefresh = false;

  constructor(
    public control: ModelController
  ){}

  static applyTo(control: ModelController){
    if("dispatch" in control)
      return

    const dispatch = new this(control);

    dispatch.initObservable();
    define(control, {
      dispatch,
      get: control,
      set: control,
      observe: dispatch.observe,
      export: dispatch.export,
      toggle: dispatch.toggle,
      refresh: dispatch.refresh
    })
    dispatch.initComputed();
  }

  public addListener(
    key: string, callback: (beat: number) => void){

    let register = this.subscribers[key];

    if(!register)
      register = this.subscribers[key] = new Set();

    register.add(callback);

    return () => register.delete(callback);
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
    subset?: string[] | (() => void), 
    onChange?: (() => void) | boolean,
    initial?: boolean) => {

    if(typeof subset == "function"){
      initial = onChange as boolean;
      onChange = subset;
      subset = Object
        .keys(this.current)
        .filter(x => !x.match(/^_/));
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

    const { control, current, subscribers} = this;
    const cleanup: Function[] = [];
    const unwatch = () => cleanup.forEach(x => x());

    if(typeof watch == "string")
      watch = [watch];

    for(const key of watch){
      const listeners = subscribers[key];
  
      if(!listeners)
        throw new Error(
          `Can't watch property ${key}, it's not tracked on this instance.`
        )
  
      const trigger = () => { 
        if(once) unwatch();
        handler.call(control, current[key], key) 
      };
  
      listeners.add(trigger);
      cleanup.push(() => listeners.delete(trigger))
    }

    return unwatch;
  }
  
  private get(keys?: string[]){
    const acc = {} as BunchOf<any>;
    const { current } = this;

    if(keys){
      for(const key of keys){
        let desc = describe(this, key);

        acc[key] = 
          desc && 
          desc.value !== undefined && 
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

  private watch(
    keys: string[], 
    observer: UpdatesEventHandler,
    fireInitial?: boolean){

    const { subscribers, current, control } = this;
    const deallocate: Function[] = [];
    const pending = new Set<string>();

    function callback(){
      const acc = {} as any;

      for(const k of keys)
        acc[k] = current[k];

      observer.call(control, acc, Array.from(pending))
      pending.clear();
    }

    for(const key of keys){
      const listeners = subscribers[key];
  
      if(!listeners)
        throw new Error(
          `Can't watch property ${key}, it's not tracked on this instance.`
        )

      const trigger = () => {
        if(!pending.length)
          setTimeout(callback, 0)
        pending.add(key);
      };

      listeners.add(trigger);
      deallocate.push(() => listeners.delete(trigger))
    }

    if(fireInitial)
      callback()

    return () => deallocate.forEach(x => x());
  }

  private update(){
    if(this.pendingRefresh)
      return;
    else
      this.pendingRefresh = true;

    setTimeout(() => {
      const needsRefresh = new Set<UpdateTrigger>();
      const { pendingUpdates, subscribers } = this;

      for(const key of pendingUpdates)
        for(const sub of subscribers[key] || [])
          needsRefresh.add(sub);

      for(const refresh of needsRefresh)
        refresh(random());

      pendingUpdates.clear();
      this.pendingRefresh = false;
    }, 0)
  }

  private initObservable(){
    const { 
      current, 
      control, 
      subscribers, 
      pendingUpdates 
    } = this;

    for(const [key, desc] of entriesOf(control)){
      if("value" in desc === false)
        continue;

      if(typeof desc.value === "function")
        continue;

      current[key] = desc.value;
      subscribers[key] = new Set();

      defineProperty(control, key, {
        enumerable: true,
        configurable: false,
        get: () => this.current[key],
        set: (value: any) => {
          if(current[key] === value) 
            return;
            
          current[key] = value;
          pendingUpdates.add(key);
    
          this.update();
        }
      })
    }
  }

  private initComputed(){
    const { current, subscribers, control } = this;
    const getters = collectGetters(control, ["Provider", "Input", "Value"]);

    for(const [key, fn] of entries(getters)){
      subscribers[key] = new Set();
  
      const onValueDidChange = () => {
        const value = fn.call(control);
  
        if(current[key] === value)
          return
  
        current[key] = value;
        this.pendingUpdates.add(key);

        for(const sub of subscribers[key] || [])
          sub(random());
      }

      const spy = createSubscription(control, onValueDidChange);
  
      current[key] = fn.call(spy);
      spy[SUBSCRIBE]();
  
      defineProperty(control, key, {
        set: () => { throw new Error(`Cannot set ${key} on this controller, it is computed.`) },
        get: () => fn.call(control),
        enumerable: true,
        configurable: true
      })
    }
  }
}

function collectGetters(
  source: any, ignore: string[] = []){

  const getters = {} as BunchOf<() => any>;

  do {
    source = getPrototypeOf(source);
    for(const [key, item] of entriesOf(source))
      if("get" in item && !getters[key] && ignore.indexOf(key) < 0)
        getters[key] = item.get!
  }
  while(source.constructor !== Controller 
     && source.constructor !== Object);

  return getters;
}

export function applyExternalValues(
  this: typeof ModelController, 
  external: BunchOf<any>
){
  this.tap().apply(external);
}

export function integrateExternal(
  this: ModelController, external: BunchOf<any>){

  Dispatch.applyTo(this);

  const { current } = this.dispatch;
  const inner = getPrototypeOf(this);

  for(const key of keysOf(external)){
    current[key] = external[key];
    defineProperty(inner, key, {
      enumerable: true,
      get: () => current[key],
      set: () => {
        throw new Error(`Cannot modify external prop '${key}'!`)
      }
    })
  }

  define(inner, "watch", updateExternalValues);

  return this;
}

function updateExternalValues(
  this: ModelController,
  external: BunchOf<any>){

  const { current } = this.dispatch;
  let updated = [];

  for(const key of keysOf(external))
    if(external[key] !== current[key]){
      current[key] = external[key];
      updated.push(key);
    }

  if(updated.length)
    this.refresh(updated);

  return this;
}