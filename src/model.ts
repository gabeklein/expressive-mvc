import * as Computed from './compute';
import { CONTROL, Controller, CREATE, keys, LOCAL, manage } from './controller';
import { useModel, useSubscriber, useWatcher } from './hooks';
import { lifecycle } from './lifecycle';
import { usePeerContext } from './peer';
import { State } from './stateful';
import { Subscriber } from './subscriber';
import { createEffect, defineLazy } from './util';

const useComponentLifecycle = lifecycle("component");

export class Model extends State {
  constructor(){
    super(false);
  }

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

  tag(id?: Key | KeyFactory<this>){
    return useSubscriber(this, id);
  }

  static [CONTROL]: Controller;

  static use(args: any[], callback?: (instance: State) => void){
    const instance = useModel(this, args, callback);
    useComponentLifecycle(instance[LOCAL]);
    usePeerContext(instance.get);
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