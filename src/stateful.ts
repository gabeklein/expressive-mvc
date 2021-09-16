import { useFromContext } from './context';
import { CONTROL, Controller, keys, LOCAL, manage, STATE, Stateful } from './controller';
import { useLazy, useModel, useWatcher } from './hooks';
import { define } from './util';

export interface State extends Stateful {
  get: this;
  set: this;

  didCreate?: Callback;
  willDestroy?: Callback;
}

export class State {
  static STATE = STATE;
  static CONTROL = CONTROL;
  static LOCAL = LOCAL;

  constructor(){
    define(this, "get", this);
    define(this, "set", this);

    Controller.init(this, () => {
      if(this.didCreate)
        this.didCreate();
    })
  }

  import(
    from: BunchOf<any>,
    subset?: Iterable<string> | Query){

    for(const key of keys(manage(this), subset))
      if(key in from)
        (this as any)[key] = from[key];
  }

  export(subset?: Iterable<string> | Query){
    const control = manage(this);
    const output: BunchOf<any> = {};

    for(const key of keys(control, subset))
      output[key] = (control.state as any)[key];

    return output;
  }

  destroy(){
    if(this.willDestroy)
      this.willDestroy();
  }

  toString(){
    return this.constructor.name;
  }

  tap(path?: string | Select, expect?: boolean){
    return useWatcher(this, path, expect);
  }

  static create<T extends Class>(
    this: T, ...args: any[]){

    const instance: InstanceOf<T> = 
      new (this as any)(...args);

    manage(instance);

    return instance;
  }

  static use(...args: any[]){
    return useModel(this, args);
  }

  static uses(props: BunchOf<any>, only?: string[]){
    return useModel(this, [], instance => {
      instance.import(props, only);
    })
  }

  static using(props: BunchOf<any>, only?: string[]){
    const instance = useModel(this, []);
    instance.import(props, only);
    return instance;
  }

  static find<T extends Class>(this: T, strict?: boolean){
    return useFromContext(this, strict) as InstanceOf<T>;
  }

  static new(...args: any[]){
    return useLazy(this, args);
  }

  static get(key?: boolean | string | Select){
    const instance: any = this.find(!!key);
  
    return (
      typeof key == "function" ?
        key(instance) :
      typeof key == "string" ?
        instance[key] :
        instance
    )
  }

  static tap(key?: string | Select, expect?: boolean): any {
    return useWatcher(this.find(true), key, expect);
  }

  static isTypeof<T extends typeof State>(
    this: T, maybe: any): maybe is T {

    return (
      typeof maybe == "function" &&
      maybe.prototype instanceof this
    )
  }
}