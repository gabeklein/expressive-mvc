import { LOCAL } from './model';
import { Observer } from './observer';
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

  constructor(
    public parent: Observer,
    public onUpdate: Callback){

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
        set: this.parent.setter(key),
        configurable: true,
        enumerable: true
      })
    }
  }

  public follow(key: string, cb?: Callback){
    this.follows[key] = cb || this.onUpdate;
  }

  public commit = () => {
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