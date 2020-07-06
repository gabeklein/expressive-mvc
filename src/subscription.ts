import { Controller } from './controller';
import { ControllerDispatch, ensureDispatch } from './dispatch';
import { Callback, LivecycleEvent, ModelController } from './types';
import { define } from './util';

export const LIFECYCLE = Symbol("subscription_lifecycle");
export const SUBSCRIPTION = Symbol("controller_subscription");

export type UpdateTrigger = Callback;
export type ModelEvent = keyof ModelController;

export function getSubscriber(control: Controller){
  const sub = control[SUBSCRIPTION];

  if(!sub)
    throw new Error("Subscription does not exist on this object.")

  return sub;
}

export class Subscription<T extends Controller = any>{
  public proxy: T;
  private master: ControllerDispatch;

  private cleanup = new Set<Callback>();
  
  constructor(
    source: T,
    private trigger: UpdateTrigger,
    private callback?: (name: LivecycleEvent) => void
  ){
    const master = this.master = ensureDispatch(source);
    const local = this.proxy = Object.create(source);

    define(local, SUBSCRIPTION, this);

    for(const key of master.managed)
      Object.defineProperty(local, key, {
        configurable: true,
        enumerable: true,
        set: (value: any) => (master.state as any)[key] = value,
        get: this.onAccess(key)
      })

    define(local, {
      onEvent: this.handleEvent,
      refresh: this.forceRefresh
    })
  }

  forceRefresh = (...keys: string[]) => {
    if(!keys[0]) 
      this.trigger();
    else
      this.master.forceRefresh(...keys)
  }

  handleEvent = (name: LivecycleEvent) => {
    if(name == "didMount")
      this.start();

    if(name == "willUnmount")
      this.stop();

    if(this.callback)
      this.callback.call(this.proxy, name);
  }

  public start(){
    for(const key of this.master.managed)
      delete (this.proxy as any)[key];
  }

  public stop(){
    for(const done of this.cleanup)
      done()
  }
  
  private onAccess = (key: string) => {
    const { master } = this;

    return () => {
      let value = (master.state as any)[key];
      let handler: Callback;

      if(value instanceof Controller){
        const sub = this.monitorRecursive(key);
        handler = sub.reset;
        value = sub.proxy;
      }
      else
        handler = this.trigger;
        
      this.cleanup.add(
        master.addListener(key, handler)
      );
  
      return value;
    }
  }

  private monitorRecursive(key: string){
    const { master } = this;
    let active!: Subscription;

    master.once("willUnmount", () => active && active.stop())

    const initSubscription = (value: Controller) => {
      active = new Subscription(value, this.trigger);
      Object.defineProperty(this.proxy, key, {
        value: active.proxy,
        configurable: true,
        enumerable: true
      })
      master.once("didRender", () => {
        delete (this.proxy as any)[key];
        active.start()
      });
      return active.proxy
    }

    const resetSubscription = () => {
      active.stop();
      initSubscription(master.state[key]);
      this.trigger();
    }

    return {
      proxy: initSubscription(master.state[key]),
      reset: resetSubscription
    };
  }
}