import { Controller } from './controller';
import { Dispatch } from './dispatch';
import { GetterInfo, metaData } from './observer';
import { create, defineProperty, traceable } from './util';

export class Subscriber<T = any> {
  private dependant = new Set<Subscriber>();

  public following = {} as BunchOf<Callback>;
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

        if(value instanceof Controller)
          return this.recursive(key);
    
        this.follow(key);
        return value;
      }

      defineProperty(this.proxy, key, {
        get: traceable(`tap ${key}`, initial),
        set: this.parent.setter(key),
        configurable: true
      })
    }
  }

  private follow(key: string, cb?: Callback){
    if(!cb)
      cb = () => this.callback();

    if(this.metadata)
      metaData(cb, this.metadata);

    this.following[key] = cb;
  }

  public commit(key?: string){
    const remove = key
      ? [key] : this.parent.watched;

    for(const key of remove)
      delete (this.proxy as any)[key];
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

  public listen(commit?: boolean){
    this.dependant.forEach(x => x.listen());
    this.parent.followers.add(this.following);

    if(commit)
      this.commit();

    return () => this.release();
  }

  public release(){
    this.dependant.forEach(x => x.release());
    this.parent.followers.delete(this.following);
  }

  public watch(
    key: string,
    subscribe: () => Subscriber | undefined){

    let child: Subscriber | undefined;

    const start = (mounted?: boolean) => {
      child = subscribe();

      if(!child)
        return;

      this.dependant.add(child);

      if(mounted)
        child.listen();
    }

    this.follow(key, () => {
      if(child){
        child.release();
        this.dependant.delete(child);
      }

      start(true);
      this.callback();
    });

    start();
  }
}