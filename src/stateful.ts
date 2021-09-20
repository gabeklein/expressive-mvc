import { prepareGetters } from './compute';
import { useFromContext } from './context';
import { CONTROL, Controller, CREATE, keys, LOCAL, manage, STATE, Stateful } from './controller';
import { useLazy, useModel, useWatcher } from './hooks';
import { issues } from './issues';
import { define, select } from './util';

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict update() did ${expected ? "not " : ""}find pending updates.`
})

export interface State extends Stateful {
  get: this;
  set: this;

  didCreate?: Callback;
  willDestroy?: Callback;
}

export class State {
  static CONTROL = CONTROL;
  static STATE = STATE;
  static INIT = CREATE;
  static LOCAL = LOCAL;

  constructor(computeGetters?: boolean){
    const control = Controller.setup(this);

    define(this, "get", this);
    define(this, "set", this);

    if(computeGetters !== false)
      prepareGetters(control);
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

  update(key: string | Select, argument?: any): PromiseLike<string[]>;
  update(strict?: boolean): Promise<string[] | false>;
  update(arg?: string | boolean | Select, tag?: any){
    const control = manage(this);

    if(typeof arg == "function")
      arg = select(this, arg);

    if(typeof arg == "boolean"){
      if(!control.pending === arg)
        return Promise.reject(Oops.StrictUpdate(arg))
    }
    else if(arg){
      control.update(arg);

      if(1 in arguments && arg in this)
        if(typeof tag != "boolean")
          (this as any)[arg](tag);
        else if(tag)
          (this as any)[arg]();
    }

    return <PromiseLike<string[] | false>> {
      then(callback){
        if(callback)
          if(control.pending)
            control.include(callback);
          else
            callback(false);
      }
    }
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

  static new(args: any[], callback?: (instance: State) => void){
    return useLazy(this, args, callback);
  }

  static use(args: any[], callback?: (instance: State) => void){
    return useModel(this, args, callback);
  }

  static uses(props: BunchOf<any>, only?: string[]){
    return this.use([], instance => {
      instance.import(props, only);
    })
  }

  static using(props: BunchOf<any>, only?: string[]){
    const instance = this.use([]);
    instance.import(props, only);
    return instance;
  }

  static find<T extends Class>(this: T, strict?: boolean){
    return useFromContext(this, strict) as InstanceOf<T>;
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