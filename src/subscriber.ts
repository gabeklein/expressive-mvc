import { Controller } from './controller';
import { LOCAL, manage, Stateful } from './model';
import { create, define, defineProperty, setAlias } from './util';

type Listener = {
  commit(): void;
  release(): void;
}

export class Subscriber {
  public proxy: any;
  public active = false;
  public follows = {} as BunchOf<Callback>;
  public dependant = new Set<Listener>();
  public parent: Controller;

  constructor(
    parent: Controller | Stateful,
    public onUpdate: Callback){

    if(!(parent instanceof Controller))
      parent = manage(parent);

    this.parent = parent;

    const proxy = this.proxy =
      create(parent.subject);

    define(proxy, LOCAL, this);

    for(const key in parent.state){
      const intercept = () => {
        this.follow(key);
        delete proxy[key];
        return proxy[key];
      }

      setAlias(intercept, `tap ${key}`);
      defineProperty(proxy, key, {
        get: intercept,
        set: parent.sets(key),
        configurable: true,
        enumerable: true
      })
    }
  }

  public follow(key: string, cb?: Callback){
    this.follows[key] = cb || this.onUpdate;
  }

  public commit(){
    const { dependant, follows, parent } = this;
    const onDone = parent.addListener(follows);

    this.active = true;
    dependant.forEach(x => x.commit());

    return this.release = () => {
      dependant.forEach(x => x.release());
      onDone();
    }
  }

  public release!: Callback;
}