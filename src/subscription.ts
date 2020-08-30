import { Controller, ModelController } from './controller';
import { Observable, OBSERVER, Observer } from './observer';
import { define, within } from './util';

export type ModelEvent = keyof ModelController;

export class Subscription<T extends Observable = any>{
  public proxy: T;
  public parent: Observer<any>;
  private cleanup = new Set<Callback>();
  
  constructor(
    public source: T,
    private refresh: Callback
  ){
    const proxy = this.proxy = Object.create(source);
    const parent = this.parent = source[OBSERVER];

    define(proxy, {
      refresh(...keys: string[]){
        if(0 in keys)
          parent.event(...keys)
        else
          refresh()
      }
    })

    for(const key of parent.managed)
      Object.defineProperty(proxy, key, {
        configurable: true,
        enumerable: true,
        set: (value) => {
          within(parent.subject, key, value);
        },
        get: () => {
          const value = within(source, key);

          if(value instanceof Controller)
            return this.monitorRecursive(key);
          else {
            const release = parent.addListener(key, refresh);
            this.cleanup.add(release);
            return value;
          }
        }
      })
  }

  public commit(...keys: string[]){
    for(const key of keys || this.parent.managed)
      delete (this.proxy as any)[key];
  }

  public stop(){
    for(const cb of this.cleanup)
      cb()
  }

  private monitorRecursive(key: string){
    const dispatch = this.parent.subject;
    let focus!: Subscription;

    const startSubscription = () => {
      const value = dispatch[key] as Controller;

      focus = new Subscription(value, this.refresh);

      Object.defineProperty(this.proxy, key, {
        get: () => focus.proxy,
        set: resetSubscription,
        configurable: true,
        enumerable: true
      })

      this.parent.once("didRender", () => {
        this.commit(key);
        focus.commit();
      });
    }

    const resetSubscription = (value?: any) => {
      if(dispatch[key] === value)
        return;
      
      if(value)
        dispatch[key] = value;
      
      focus.stop();
      startSubscription();
      this.refresh();
    }

    this.cleanup.add(
      this.parent.addListener(key, resetSubscription)
    );

    this.cleanup.add(() => 
      focus && focus.stop()
    )
    
    startSubscription();

    return focus.proxy;
  }
}