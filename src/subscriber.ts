import { Controllable, Controller } from './controller';
import { Model } from './model';
import { GetterInfo, metaData, Observer } from './observer';
import { alias, create, defineProperty } from './util';

export class Subscriber<T extends Controllable = any> {
  protected dependant = new Set<{
    listen(): void;
    release(): void;
    commit?(): void;
  }>();

  public following = {} as BunchOf<Callback>;
  public parent: Observer;
  public proxy: T;
  
  constructor(
    public subject: T,
    protected callback: Callback,
    protected metadata?: GetterInfo){

    const { state } = this.parent =
      Controller.get(subject);

    this.proxy = create(subject as any);

    for(const key in state)
      this.spyOn(key);
  }

  private spyOn(key: string){
    const access = () => {
      let value = (this.subject as any)[key];

      if(value instanceof Model)
        return this.delegate(key);

      this.follow(key, this.callback);
      delete (this.proxy as any)[key];
      return value;
    }

    defineProperty(this.proxy, key, {
      get: alias(access, `tap ${key}`),
      set: this.parent.setter(key),
      configurable: true
    })
  }

  private follow(key: string, cb: Callback){
    if(this.metadata)
      metaData(cb, this.metadata);

    this.following[key] = cb;
  }

  private delegate(key: string){
    let sub: Subscriber | undefined;

    this.watch(key, () => {
      let value = (this.subject as any)[key];

      if(value instanceof Model){
        let child = sub = new Subscriber(
          value, this.callback, this.metadata
        );

        defineProperty(this.proxy, key, {
          get: () => child.proxy,
          set: it => (this.subject as any)[key] = it,
          configurable: true
        })

        return child;
      }
    });

    return sub && sub.proxy;
  }

  public listen(){
    this.dependant.forEach(x => x.listen());
    this.parent.followers.add(this.following);

    // for(const key in this.proxy)
    //   delete this.proxy[key];

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

      if(child){
        this.dependant.add(child);
  
        if(mounted)
          child.listen();
      }
    }

    const reset = () => {
      if(child){
        child.release();
        this.dependant.delete(child);
      }

      start(true);
      this.callback();
    }

    this.follow(key, reset);
    start();
  }
}