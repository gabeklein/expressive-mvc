import { Controller } from './controller';
import { Dispatch } from './dispatch';
import { GetterInfo, metaData } from './observer';
import { create, defineProperty, traceable } from './util';

export class Subscriber<T = any> {
  private onDone = [] as Callback[];
  public following = [] as string[];
  public parent: Dispatch;
  public proxy: T;
  
  constructor(
    public subject: T,
    private callback: Callback,
    private metadata?: GetterInfo){

    this.proxy = create(subject as any);
    this.parent = Dispatch.for(subject);

    for(const key of this.parent.watched){
      const initial = () => {
        let value = (this.subject as any)[key];

        this.following.push(key);

        if(value instanceof Controller)
          return this.recursive(key) || value;
    
        this.listen(key);
        return value;
      }

      defineProperty(this.proxy, key, {
        get: traceable(`tap ${key}`, initial),
        set: this.parent.setter(key),
        configurable: true
      })
    }
  }

  private listen(key: string, cb?: Callback){
    if(!cb)
      cb = () => this.callback();

    if(this.metadata)
      metaData(cb, this.metadata);
      
    this.onDone.push(
      this.parent.addListener(key, cb)
    )
  }

  public commit(key?: string){
    const remove = key
      ? [key] : this.parent.watched;

    for(const key of remove)
      delete (this.proxy as any)[key];
  }

  public release(){
    for(const callback of this.onDone)
      callback()
  }

  private recursive(key: string){
    const { subject, callback, parent, proxy } = this;
    let sub: Subscriber | undefined;

    this.watch(key, () => {
      let value = (subject as any)[key];

      if(value instanceof Controller){
        let child = sub =
          new Subscriber(value, callback);
    
        parent.once("didRender", () => {
          child.commit();
          this.commit(key);
        });

        defineProperty(proxy, key, {
          get: () => child.proxy,
          set: it => (subject as any)[key] = it,
          configurable: true,
          enumerable: true
        })

        return child;
      }
    });

    return sub && sub.proxy;
  }

  public focus(key: string){
    this.watch(key, () => {
      let value = (this.subject as any)[key];

      if(value instanceof Controller){
        const child = new Subscriber(value, this.callback);

        this.parent.once("didRender", () => child.commit());
        this.proxy = child.proxy as any;

        return child;
      }

      this.proxy = value;
    });

    return this;
  }

  public watch(
    key: string,
    subscribe: () => Subscriber | undefined){

    let child: Subscriber | undefined;

    const start = () => {
      child = subscribe();
    }
    const stop = () => {
      if(child){
        child.release();
        child = undefined;
      }
    }

    this.onDone.push(stop);
    this.listen(key, () => {
      stop();
      start();
      this.callback();
    });

    start();
  }
}