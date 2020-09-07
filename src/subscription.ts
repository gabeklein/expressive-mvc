import { Controller } from './controller';
import { Observer } from './observer';
import { define, within } from './util';

export class Subscription<T extends Any = Any>{
  public proxy: T;
  public source: T;
  private cleanup = [] as Callback[];
  
  constructor(
    public parent: Observer,
    private refresh: Callback,
    focus?: string
  ){
    const source = this.source = parent.subject;
    const proxy = this.proxy = Object.create(source);

    define(proxy, {
      get: source,
      set: source,
      refresh(...keys: string[]){
        if(0 in keys)
          parent.emit(...keys)
        else
          refresh()
      }
    })

    if(focus)
      this.monitorRecursive(focus, true);
    else
      this.monitorAutomatic();
  }

  public follow(key: string){
    this.cleanup.push(
      this.parent.addListener(key, this.refresh)
    )
  }

  public commit(...keys: string[]){
    for(const key of keys || this.parent.watched)
      delete (this.proxy as any)[key];
  }

  public release(){
    for(const callback of this.cleanup)
      callback()
  }

  private monitorAutomatic(){
    const source = this.source as Any;

    for(const key of this.parent.watched)
      Object.defineProperty(this.proxy, key, {
        configurable: true,
        set: (value) => source[key] = value,
        get: () => {
          let value = source[key];

          if(value instanceof Controller)
            value = this.monitorRecursive(key);
          else
            this.follow(key);

          return value;
        }
      })
  }

  protected monitorRecursive(
    key: string, focus?: boolean){

    let sub: Subscription | undefined;

    const onUpdate = () => {
      sub?.release();
      applyChild();
      this.refresh();
    }

    const applyChild = () => {
      let value = this.source[key];

      if(value instanceof Controller){
        sub = new Subscription(value.getDispatch(), this.refresh);
        value = sub.proxy;
  
        this.parent.once("didRender", () => {
          if(sub)
            sub.commit();
          if(!focus)
            this.commit(key);
        });
      }
  
      if(focus)
        Object.defineProperty(this, "proxy", {
          value: value,
          configurable: true
        })
      else
        Object.defineProperty(this.proxy, key, {
          get: () => value,
          set: val => within(this.source, key, val),
          configurable: true,
          enumerable: true
        })

      return value;
    }

    const release =
      this.parent.addListener(key, onUpdate);
    
    this.cleanup.push(() => {
      release();
      if(sub)
        sub.release();
    });

    return applyChild();
  }
}