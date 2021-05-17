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

        if(value instanceof Controller){
          const sub = this.followRecursive(key);

          if(sub)
            return sub.proxy;
        }

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
      delete (this.proxy as any)[key];
  }

  public release(){
    for(const callback of this.cleanup)
      callback()
  }

  public focus(key: string){
    this.fork(key, () => {
      let sub: Subscriber<any> | undefined;
      let value = (this.subject as any)[key];

      if(value instanceof Controller){
        sub = new Subscriber(value, this.callback);
        this.parent.once("didRender", () => sub!.commit());
      }
  
      defineProperty(this, "proxy", {
        get: () => sub ? sub.proxy : value,
        configurable: true
      })

      return sub;
    })

    return this;
  }

  public fork(
    key: string,
    subscribe: () => Subscriber | undefined){

    const { cleanup, callback } = this;
    let child: Subscriber | undefined;

    const create = () => child = subscribe();
    const release = () => child && child.release();
    const updated = () => {
      release();
      create();
      callback();
    }

    this.follow(key, updated);
    cleanup.push(release);

    return create();
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
    return this.fork(key, () => {
      const { subject } = this.parent;
      let value = (subject as any)[key];
      let sub = new Subscriber(value, this.callback);
  
      this.parent.once("didRender", () => {
        sub!.commit();
        this.commit(key);
      });

      defineProperty(this.proxy, key, {
        get: () => sub.proxy,
        set: it => (subject as any)[key] = it,
        configurable: true,
        enumerable: true
      })

      return sub;
    });
  }
}