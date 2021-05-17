import { Controller } from './controller';
import { Dispatch } from './dispatch';
import { assign, create, defineProperty, fn, setDisplayName } from './util';

export class Subscriber<T = any> {
  private cleanup = [] as Callback[];
  public watched = [] as string[];
  public parent: Dispatch;
  public proxy: T;
  
  constructor(
    public subject: T,
    private callback: Callback,
    private metadata?: {}
  ){
    assign(callback, metadata);
    this.parent = Dispatch.get(subject);
    this.proxy = this.spy();
  }

  public spy(){
    const source = this.subject as any;
    const proxy = create(source);

    for(const key of this.parent.watched){
      const subscribe = () => {
        let value = source[key];

        if(value instanceof Controller)
          return this.followRecursive(key);

        this.follow(key);
        return value;
      }

      setDisplayName(subscribe, `tap ${key}`);
      defineProperty(proxy, key, {
        configurable: true,
        set: this.parent.setter(key),
        get: subscribe
      })
    }

    return proxy;
  }

  public declare(event: string, args?: any[]){
    const target = this.subject as any;
    const handle = target[event];

    if(fn(handle))
      handle.apply(target, args);

    this.parent.emit(event);
  }

  public commit(key?: string){
    const remove = key
      ? [key] : this.parent.watched;

    for(const key of remove)
      delete (this.proxy as any)[key!];
  }

  public release(){
    for(const callback of this.cleanup)
      callback()
  }

  public focus(key: string){
    let sub: Subscriber<any> | undefined;

    const spy = () => {
      let value = (this.subject as any)[key];

      if(value instanceof Controller){
        sub = new Subscriber(value, this.callback);
        this.parent.once("didRender", () => sub!.commit());
      }
  
      defineProperty(this, "proxy", {
        get: () => sub ? sub.proxy : value,
        configurable: true
      })
    }

    const stop = () => sub && sub.release();

    const updated = () => {
      stop();
      spy();
      this.callback();
    }

    this.follow(key, updated);
    this.cleanup.push(stop);

    spy();

    return this;
  }

  private follow(key: string, callback?: Callback){
    if(callback)
      assign(callback, this.metadata);
    else
      callback = this.callback;

    this.watched.push(key);
    this.cleanup.push(
      this.parent.addListener(key, callback)
    )
  }

  private followRecursive(key: string){
    let sub: Subscriber<any> | undefined;

    const spy = () => {
      const { subject } = this.parent;
      let value = (subject as any)[key];

      if(value instanceof Controller){
        sub = new Subscriber(value, this.callback);
        value = sub.proxy;
  
        this.parent.once("didRender", () => {
          sub!.commit();
          this.commit(key);
        });
      }

      defineProperty(this.proxy, key, {
        get: () => value,
        set: x => (subject as any)[key] = x,
        configurable: true,
        enumerable: true
      })

      return value;
    }

    const stop = () => sub && sub.release();

    const update = () => {
      stop();
      spy();
      this.callback();
    }

    this.follow(key, update);
    this.cleanup.push(stop);

    return spy();
  }
}