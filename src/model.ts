import * as Computed from "./compute";
import { CONTROL, Controller, CREATE, keys, manage } from './controller';
import { useSubscriber, useWatcher } from './hooks';
import { issues } from './issues';
import { State } from './stateful';
import { Subscriber } from './subscriber';
import { createEffect, defineLazy } from './util';

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict update() did ${expected ? "not " : ""}find pending updates.`
})

export class Model extends State {
  [CREATE](using: Controller){
    defer(using, "on");
    defer(using, "effect");

    return () => {
      delete (this as any).on;
      delete (this as any).effect;
    }
  }

  on(
    subset: string | Iterable<string> | Query,
    handler: Function,
    squash?: boolean,
    once?: boolean){

    const control = manage(this);
    const set = keys(control, subset);
    const batch = {} as BunchOf<RequestCallback>;
    const remove = control.addListener(batch);

    const callback: RequestCallback = squash
      ? handler.bind(this)
      : (frame: string[]) => {
        for(const key of frame)
          if(set.includes(key))
            handler.call(this, control.state[key], key);
      }

    const handle = once
      ? (k?: string[]) => { remove(); callback(k) }
      : callback;

    for(const key of set)
      batch[key] = handle;

    Computed.ensure(control, set);

    return remove;
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

function defer(on: Controller, method: string){
  const { subject, waiting } = on as any;
  const real = subject[method];

  subject[method] = (...args: any[]) => {
    let done: any;
    waiting.push(() => {
      done = real.apply(subject, args);
    });
    return () => done();
  }
}