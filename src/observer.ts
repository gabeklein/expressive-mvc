import { isInitialCompute } from './dispatch';
import { lifecycleEvents } from './subscriber';
import { UpdateTrigger } from './subscription';
import { BunchOf, HandleUpdatedValue } from './types';
import { Set } from './util';

type UpdateEventHandler = (value: any, key: string) => void;
type UpdatesEventHandler = (observed: {}, updated: string[]) => void;

export class Observer<T> {
  constructor(
    public subject: T
  ){}
  
  protected state = {} as BunchOf<any>;
  protected pending = new Set<string>();
  protected subscribers = {} as BunchOf<Set<() => void>>

  public get values(){
    return Object.assign({}, this.state);
  }

  public get managed(){
    return Object.keys(this.subscribers);
  }

  public onChange(
    key: string | string[],
    listener?: (changed: string[]) => void){

    if(listener)
      this.observe(key, listener, true);
    else
      return new Promise(resolve => {
        this.observe(key, resolve, true);
      });
  }

  public on(
    target: string | string[],
    listener: HandleUpdatedValue<any, any>){

    return this.observe(target, listener);
  }

  public once(
    target: string,
    listener?: HandleUpdatedValue<any, any>){
      
    if(listener)
      this.observe(target, listener, true);
    else
      return new Promise(resolve => {
        this.observe(target, resolve, true);
      });
  }

  public observe(
    watch: string | string[],
    handler: UpdateEventHandler,
    once?: boolean){

    if(typeof watch == "string")
      watch = [watch];

    //TODO: dont use multi-listener by default
    const onDone = this.addListenerForMultiple(watch, (key) => {
      if(once)
        onDone();
        
      handler.call(this.subject, this.state[key], key);
    });

    return onDone;
  }

  public pick(keys?: string[]){
    const acc = {} as BunchOf<any>;

    if(keys){
      for(const key of keys)
        acc[key] = (this.subject as any)[key];

      return acc;
    }

    for(const key in this){
      const desc = Object.getOwnPropertyDescriptor(this, key);

      if(!desc)
        continue;

      if(desc.value !== undefined)
        acc[key] = desc.value;
    }

    for(const key in this.subscribers)
      acc[key] = this.state[key];

    return acc;
  }

  public watch(
    keys: string[],
    observer: UpdatesEventHandler,
    fireInitial?: boolean){

    const pending = new Set<string>();

    const callback = () => {
      const acc = {} as any;

      for(const k of keys)
        acc[k] = this.state[k];

      observer.call(this.subject, acc, Array.from(pending));
      pending.clear();
    };

    const onDone = this.addListenerForMultiple(keys, (key) => {
      if(!pending.length)
        setTimeout(callback, 0);

      pending.add(key);
    });

    if(fireInitial)
      callback();

    return onDone;
  }

  protected update(){
    if(!this.pending.size)
      return;

    setTimeout(() => {
      const queued = new Set<UpdateTrigger>();
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
    callback: UpdateTrigger){

    let register = this.subscribers[key];

    if(!register)
      register = this.subscribers[key] = new Set();

    register.add(callback);

    return () => register.delete(callback);
  }

  private addListenerForMultiple(
    keys: string[],
    callback: (didUpdate: string) => void){

    let clear: Function[] = [];

    for(const key of keys){
      let listeners = this.subscribers[key];

      if(!listeners)
        if(lifecycleEvents.indexOf(key) < 0)
          throw new Error(
            `Can't watch property ${key}, it's not tracked on this instance.`
          );
        else
          listeners = this.subscribers[key] = new Set();

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