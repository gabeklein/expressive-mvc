import { CONTROL, Controller, keys, manage } from './controller';
import { useModel, useSubscriber, useWatcher } from './hooks';
import { issues } from './issues';
import { State } from './stateful';
import { Subscriber } from './subscriber';
import { createEffect, defineLazy } from './util';

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict update() did ${expected ? "not " : ""}find pending updates.`
})

export class Model extends State {
  on(
    select: string | Iterable<string> | Query,
    callback: UpdateCallback<any, any>,
    squash?: boolean,
    once?: boolean){

    return manage(this).watch(select, callback, squash, once);
  }

  once(
    select: string | Iterable<string> | Query,
    callback?: UpdateCallback<any, any>,
    squash?: boolean){

    if(callback)
      return this.on(select, callback, squash, true);
    else 
      return new Promise<void>(resolve => {
        this.on(select, resolve, true, true);
      });
  }

  effect(
    callback: EffectCallback<any>,
    select?: string[] | Query){

    const control = manage(this);
    let target = this;

    const effect = createEffect(callback);
    const invoke = () => effect.call(target, target);

    if(select){
      invoke();
      return this.on(select, invoke, true);
    }
    else {
      const sub = new Subscriber(control, invoke);
      target = sub.proxy;
      invoke();
      return sub.commit();
    }
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

  update(arg: string | string[] | Query | boolean){
    const control = manage(this);

    if(typeof arg == "boolean"){
      if(!control.pending === arg)
        return Promise.reject(Oops.StrictUpdate(arg))
    }
    else if(arg)
      for(const key of keys(control, arg))
        control.update(key);

    if(control.pending)
      return new Promise(cb => control.include(cb));

    return Promise.resolve(false);
  }

  tag(id?: Key | KeyFactory<this>){
    return useSubscriber(this, id);
  }

  static [CONTROL]: Controller;

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

  static tag(id?: Key | ((target: Model) => Key | undefined)){
    return useSubscriber(this.find(true), id);
  }

  static meta(path: string | Select): any {
    return useWatcher(this, path);
  }
}

defineLazy(Model, CONTROL, function(){
  return new Controller(this).start();
})
