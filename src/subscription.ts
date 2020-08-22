import { Controller, ModelController } from './controller';
import { LivecycleEvent } from './hook';
import { getObserver, Observable, Observer } from './observer';
import { define } from './util';

export const LIFECYCLE = Symbol("subscription_lifecycle");
export const SUBSCRIPTION = Symbol("controller_subscription");

export type ModelEvent = keyof ModelController;

export function getSubscriber(control: Controller){
  const sub = control[SUBSCRIPTION];

  if(!sub)
    throw new Error("Subscription does not exist on this object.")

  return sub;
}

export class Subscription<T extends Observable = any>{
  public proxy: T;
  private master: Observer<any>;

  private cleanup = new Set<Callback>();
  
  constructor(
    source: T,
    private trigger: Callback,
    private callback?: (name: LivecycleEvent) => void
  ){
    const master = this.master = getObserver(source);
    const local = this.proxy = Object.create(source);

    define(local, SUBSCRIPTION, this);

    for(const key of master.managed)
      Object.defineProperty(local, key, {
        configurable: true,
        enumerable: true,
        set: (value: any) => (master.subject as any)[key] = value,
        get: this.onAccessTrigger(key)
      })

    define(local, {
      use: local,
      onEvent: this.handleEvent,
      refresh: this.forceRefresh
    })
  }

  forceRefresh = (...keys: string[]) => {
    if(!keys[0]) 
      this.trigger();
    else
      this.master.trigger(...keys)
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
  
  private onAccessTrigger = (key: string) => {
    return () => {
      const value = (this.master.subject as any)[key];

      if(value instanceof Controller)
        return this.monitorRecursive(key);
        
      const done = this.master.addListener(key, this.trigger);
      this.cleanup.add(done);
      return value;
    }
  }

  private monitorRecursive(key: string){
    const { master } = this;
    const dispatch: any = master.subject;

    let active!: Subscription;

    const startSubscription = () => {
      const value = dispatch[key] as Controller;
      value.initialize();
      active = new Subscription(value, this.trigger);
      Object.defineProperty(this.proxy, key, {
        get: () => active.proxy,
        set: resetSubscription,
        configurable: true,
        enumerable: true
      })
      master.once("didRender", () => {
        delete (this.proxy as any)[key];
        active.start()
      });
    }

    const resetSubscription = (value?: any) => {
      if(dispatch[key] == value)
        return
      
      if(value)
        dispatch[key] = value;
      
      active.stop();
      startSubscription();
      this.trigger();
    }

    master.once("willUnmount", () => active && active.stop())

    this.cleanup.add(
      master.addListener(key, resetSubscription)
    );
    
    startSubscription();

    return active.proxy;
  }
}