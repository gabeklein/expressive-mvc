import { Controller } from './controller';
import { Callback, LivecycleEvent, ModelController } from './types';
import { define, Set } from './util';
import { getDispatch, ControllerDispatch } from './dispatch';

export const LIFECYCLE = Symbol("subscription_lifecycle");
export const SUBSCRIPTION = Symbol("controller_subscription");

export type UpdateTrigger = Callback;
export type ModelEvent = keyof ModelController;

export function createSubscription<T extends Controller>(
  source: T,
  trigger: UpdateTrigger,
  callback?: (name: LivecycleEvent) => void
){
  return new Subscription(source, trigger, callback).proxy;
}

export function getSubscriber(control: Controller){
  const sub = control[SUBSCRIPTION];

  if(!sub)
    throw new Error("Subscription does not exist on this object.")

  return sub;
}

export class Subscription<T extends Controller>{
  public proxy: T;
  private master: ControllerDispatch;

  private watch: Set<string>;
  private cleanup?: Set<Callback>;
  private exclude?: Set<string>;
  
  constructor(
    source: T,
    private trigger: UpdateTrigger,
    private callback?: (name: LivecycleEvent) => void
  ){
    const local = this.proxy = Object.create(source);
    const dispatch = this.master = getDispatch(source);
    const watch = this.watch = new Set();

    for(const key of dispatch.managed)
      Object.defineProperty(local, key, {
        configurable: true,
        enumerable: true,
        set(value: any){
          (source as any)[key] = value
        },
        get(){
          watch.add(key);
          return (source as any)[key];
        }
      })

    define(local, SUBSCRIPTION, this)
    define(local, {
      onEvent: this.handleEvent,
      refresh: this.forceRefresh,
      on: this.alsoWatch,
      only: this.onlyWatch,
      not: this.dontWatch
    })
  }

  protected forceRefresh = (...keys: string[]) => {
    if(!keys[0]) 
      this.trigger();
    else
      this.master.forceRefresh(...keys)
  }

  protected handleEvent = (name: LivecycleEvent) => {
    if(name == "didMount")
      this.start();
    if(name == "willUnmount")
      this.stop();
    if(this.callback)
      this.callback.call(this.proxy, name);
  }

  public start = () => {
    const { exclude, watch, master, trigger } = this;

    this.stopInference();

    if(exclude)
      for(const k of exclude)
        watch.delete(k);

    if(watch.size === 0)
      return;

    const cleanup = this.cleanup = new Set();

    for(const key of watch)
      cleanup.add(
        master.addListener(key, trigger)
      )
  }

  public stop = () => {
    if(this.cleanup)
      for(const unsub of this.cleanup)
        unsub()
  }

  private stopInference(){
    for(const key of this.master.managed)
      delete (this.proxy as any)[key];
  }

  public dontWatch(...keys: string[]){
    this.exclude = new Set();

    for(let arg of keys)
      for(const key of arg.split(","))
        this.exclude.add(key);
        
    return this.proxy;
  }

  public alsoWatch(...keys: string[]){
    for(let arg of keys)
      for(const key of arg.split(","))
        this.watch.add(key);

    return this.proxy;
  }

  public onlyWatch(...keys: string[]){
    for(let arg of keys)
      for(const key of arg.split(","))
        this.watch.add(key);

    this.stopInference();

    return this.proxy;
  }
}