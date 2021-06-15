import { Controllable, Controller } from './controller';
import { Model } from './model';
import { GetterInfo, metaData, Observer } from './observer';
import { alias, create, defineProperty, keys } from './util';

export class Subscriber<T extends Controllable = any> {
  protected dependant = new Set<{
    listen(): void;
    release(): void;
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

      this.follow(key);
      return value;
    }

    defineProperty(this.proxy, key, {
      get: alias(access, `tap ${key}`),
      set: this.parent.setter(key),
      configurable: true
    })
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
      ? [key] : keys(this.parent.state);

    for(const key of remove)
      delete (this.proxy as any)[key];
  }

  private delegate(key: string){
    let sub: Subscriber | undefined;

    this.watch(key, () => {
      let value = (this.subject as any)[key];

      if(value instanceof Model)
        return sub = this.forwardTo(key, value);
    });

    return sub && sub.proxy;
  }

  forwardTo(key: string, from: Model){
    let child = new Subscriber(from, this.callback);

    this.parent.watch("didRender", () => {
      child.commit();
      this.commit(key);
    }, true);

    defineProperty(this.proxy, key, {
      get: () => child.proxy,
      set: it => (this.subject as any)[key] = it,
      configurable: true
    })

    return child;
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

      if(child){
        this.dependant.add(child);
  
        if(mounted)
          child.listen();
      }
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