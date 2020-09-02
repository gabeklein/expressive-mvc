import { Controller } from './controller';
import { Observer } from './observer';
import { define, within } from './util';

export class Subscription<T extends Any = Any>{
  public proxy: T;
  public source: T;
  private cleanup = [] as Callback[];
  
  constructor(
    public parent: Observer,
    private refresh: Callback
  ){
    const source = this.source = parent.subject;
    const proxy = this.proxy = Object.create(source);

    define(proxy, {
      get: source,
      set: source,
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
          within(source, key, value);
        },
        get: () => {
          const value = within(source, key);

          if(value instanceof Controller)
            return this.monitorRecursive(key);
          else {
            const release = parent.addListener(key, refresh);
            this.cleanup.push(release);
            return value;
          }
        }
      })
  }

  public commit(...keys: string[]){
    for(const key of keys || this.parent.managed)
      delete (this.proxy as any)[key];
  }

  public release(){
    for(const callback of this.cleanup)
      callback()
  }

  private monitorRecursive(key: string){
    const { cleanup, source, parent, refresh } = this;
    let focus!: Subscription;

    const startSubscription = () => {
      const value = source[key] as Controller;

      focus = new Subscription(value.getDispatch(), refresh);

      Object.defineProperty(this.proxy, key, {
        get: () => focus.proxy,
        set: resetSubscription,
        configurable: true,
        enumerable: true
      })

      parent.once("didRender", () => {
        this.commit(key);
        focus.commit();
      });
    }

    const resetSubscription = (value?: any) => {
      if(source[key] === value)
        return;

      
      focus.release();
      startSubscription();
      refresh();
    }

    cleanup.push(
      parent.addListener(key, resetSubscription),
      () => focus && focus.release()
    );

    startSubscription();

    return focus.proxy;
  }
}