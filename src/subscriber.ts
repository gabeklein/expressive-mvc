import { Controller, Observable, observe } from './controller';
import { Observer } from './observer';
import { create, define, defineProperty, within } from './util';

import Oops from './issues';

export class Subscriber {
  private onRelease = [] as Callback[];
  public parent: Observer;
  
  constructor(
    private subject: Observable,
    private refresh: Callback
  ){
    this.parent = observe(subject);
  }

  public get proxy(){
    const master = within(this.subject);
    const proxy = create(master);

    define(proxy, {
      get: master,
      set: master
    });

    for(const key of this.parent.watched)
      defineProperty(proxy, key, {
        configurable: true,
        set: (value) => {
          master[key] = value;
        },
        get: () => {
          let value = master[key];

          if(value instanceof Controller)
            value = this.followRecursive(key);
          else
            this.follow(key);

          return value;
        }
      })

    define(this, { proxy });
    return proxy;
  }

  public commit(...keys: maybeStrings){
    if(keys.length == 0)
      keys.push(...this.parent.watched)

    for(const key of keys)
      delete (this.proxy as any)[key!];
  }

  public release(){
    for(const callback of this.onRelease)
      callback()
  }

  public focus(keys: maybeStrings){
    const [ key, ...rest ] = keys.filter(x => x);

    if(!key)
      return this;
      
    let sub: Subscriber | undefined;

    const reset = () => sub && sub.release();

    const monitorChild = () => {
      let value = this.parent.subject[key];

      if(value instanceof Controller){
        sub = new Subscriber(value, this.refresh);
        sub.focus(rest);

        this.parent.once("didRender", () => sub!.commit());
      }
      else if(rest.length)
        throw Oops.FocusIsDetatched();
  
      defineProperty(this, "proxy", {
        get: () => sub ? sub.proxy : value,
        configurable: true
      })
    }

    const onUpdate = () => {
      reset();
      monitorChild();
      this.refresh();
    }

    this.follow(key, onUpdate);
    this.onRelease.push(reset);

    monitorChild();

    return this;
  }

  protected follow(key: string, cb?: Callback){
    this.onRelease.push(
      this.parent.addListener(key, cb || this.refresh)
    )
  }

  protected followRecursive(key: string){
    const { subject } = this.parent;
    let sub: Subscriber | undefined;

    const reset = () => sub && sub.release();

    const applyChild = () => {
      let value = subject[key];

      if(value instanceof Controller){
        sub = new Subscriber(value, this.refresh);
        value = sub.proxy;
  
        this.parent.once("didRender", () => {
          sub!.commit();
          this.commit(key);
        });
      }

      defineProperty(this.proxy, key, {
        get: () => value,
        set: val => subject[key] = val,
        configurable: true,
        enumerable: true
      })

      return value;
    }

    const onUpdate = () => {
      reset();
      applyChild();
      this.refresh();
    }

    this.follow(key, onUpdate);
    this.onRelease.push(reset);

    return applyChild();
  }
}