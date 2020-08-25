import { Controller, ModelController, within } from './controller';
import { LivecycleEvent } from './lifecycle';
import { Observable, Observer, OBSERVER } from './observer';
import { define } from './util';

export type ModelEvent = keyof ModelController;

export class Subscription<T extends Observable = any>{
  public proxy: T;
  private master: Observer<any>;
  private cleanup = new Set<Callback>();
  
  constructor(
    public source: T,
    private trigger: Callback
  ){
    const master = this.master = source[OBSERVER];
    const local = this.proxy = Object.create(source);

    for(const key of master.managed)
      Object.defineProperty(local, key, {
        configurable: true,
        enumerable: true,
        set: (value: any) => within(master.subject, key, value),
        get: this.beginWatchOnAccess(key)
      })

    define(local, {
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
  }

  public start(){
    for(const key of this.master.managed)
      delete (this.proxy as any)[key];
  }

  public stop(){
    for(const done of this.cleanup)
      done()
  }
  
  private beginWatchOnAccess = (key: string) => {
    return () => {
      const value = within(this.master.subject, key);

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

    master.once("willUnmount", () => {
      if(active)
        active.stop()
    })

    this.cleanup.add(
      master.addListener(key, resetSubscription)
    );
    
    startSubscription();

    return active.proxy;
  }
}