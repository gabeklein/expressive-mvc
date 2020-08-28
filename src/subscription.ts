import { Controller, ModelController } from './controller';
import { Observable, OBSERVER, Observer } from './observer';
import { define, within } from './util';

export type ModelEvent = keyof ModelController;

export class Subscription<T extends Observable = any>{
  public proxy: T;
  private master: Observer<any>;
  private cleanup = new Set<Callback>();
  
  constructor(
    public source: T,
    private refresh: Callback
  ){
    const master = this.master = source[OBSERVER];
    const proxy = this.proxy = Object.create(source);

    for(const key of master.managed)
      Object.defineProperty(proxy, key, {
        configurable: true,
        enumerable: true,
        set: (value) => {
          within(master.subject, key, value);
        },
        get: () => {
          const value = within(source, key);

          if(value instanceof Controller)
            return this.monitorRecursive(key);
          else {
            const release = master.addListener(key, refresh);
            this.cleanup.add(release);
            return value;
          }
        }
      })

    define(proxy, {
      refresh(...keys: string[]){
        if(0 in keys)
          master.trigger(...keys)
        else
          refresh()
      }
    })
  }

  public start(){
    for(const key of this.master.managed)
      delete (this.proxy as any)[key];
  }

  public stop(){
    for(const cb of this.cleanup)
      cb()
  }

  private monitorRecursive(key: string){
    const { master } = this;
    const dispatch: any = master.subject;

    let active!: Subscription;

    const startSubscription = () => {
      const value = dispatch[key] as Controller;

      active = new Subscription(value, this.refresh);

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
      this.refresh();
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