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
      this.monitorProperty(focus, true);
    else
      this.capture();
  }

  private capture(){
    const { parent, proxy, source, refresh } = this;

    for(const key of parent.watched)
      Object.defineProperty(proxy, key, {
        configurable: true,
        enumerable: true,
        set: (value) => {
          within(source, key, value);
        },
        get: () => {
          const value = within(source, key);

          if(value instanceof Controller)
            return this.monitorProperty(key);
          else {
            const release = parent.addListener(key, refresh);
            this.cleanup.push(release);
            return value;
          }
        }
      })
  }

  public commit(...keys: string[]){
    for(const key of keys || this.parent.watched)
      delete (this.proxy as any)[key];
  }

  public release(){
    for(const callback of this.cleanup)
      callback()
  }

  public monitorProperty(
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

    const stopSubscribe =
      this.parent.addListener(key, onUpdate);
    
    this.cleanup.push(
      () => sub?.release(),
      stopSubscribe
    );

    applyChild();

    return applyChild();
  }
}