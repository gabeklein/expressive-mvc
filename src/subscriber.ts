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
    private metadata?: GetterInfo
  ){
    this.parent = Dispatch.for(subject);
    this.proxy = create(subject as any);

    for(const key of this.parent.watched){
      const access = () => this.spyOn(key);

      defineProperty(this.proxy, key, {
        get: traceable(`tap ${key}`, access),
        set: this.parent.setter(key),
        configurable: true
      })
    }
  }

  private spyOn(key: string){
    const source = this.subject as any;
    let sub: Subscriber | undefined;

    this.listen(key, () => {
      let value = source[key];

      if(value instanceof Controller){
        let child = new Subscriber(value, this.callback);
    
        this.parent.once("didRender", () => {
          child.commit();
          this.commit(key);
        });

        defineProperty(this.proxy, key, {
          get: () => child.proxy,
          set: it => source[key] = it,
          configurable: true,
          enumerable: true
        })

        return sub = child;
      }
    });

    this.following.push(key);

    return sub
      ? sub.proxy
      : this.parent.state[key];
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

  public focus(key: string){
    this.listen(key, () => {
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

  public listen(
    key: string,
    subscribe: () => Subscriber | undefined){

    let child: Subscriber | undefined;

    const create = () => {
      child = subscribe();
    }
    const release = () => {
      child && child.release();
      child = undefined;
    }
    const update = () => {
      release();
      create();
      this.callback();
    }

    const unwatch =
      this.parent.addListener(key, update);
      
    this.onDone.push(() => {
      release();
      unwatch();
    });

    if(this.metadata)
      metaData(update, this.metadata);

    create();
  }
}