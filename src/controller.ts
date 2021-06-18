import { lifecycleEvents } from './lifecycle';
import { Observer } from './observer';
import { Subscriber } from './subscriber';
import {
  assign,
  createEffect,
  debounce,
  fn,
  keys,
  selectRecursive
} from './util';

import Oops from './issues';

export class Controller extends Observer {
  public do(fn: () => Callback){
    return fn();
  }

  public select(
    using: string | Iterable<string> | Query){

    if(typeof using == "string")
      return [ using ];

    if(fn(using))
      return selectRecursive(using, 
        keys(this.state).concat(lifecycleEvents)
      );

    return Array.from(using);
  }

  public watch(
    target: string | Iterable<string> | Query,
    handler: any,
    squash?: boolean,
    once?: boolean){

    return this.do(
      () => super.watch(
        this.select(target),
        handler, squash, once
      )
    );
  }

  public on = (
    select: string | Iterable<string> | Query,
    listener: UpdateCallback<any, any>,
    squash?: boolean,
    once?: boolean) => {

    return this.watch(select, listener, squash, once)
  }

  public once = (
    select: string | Iterable<string> | Query,
    listener?: UpdateCallback<any, any>,
    squash?: boolean) => {

    if(listener)
      return this.watch(select, listener, squash, true);
    else 
      return new Promise<void>(resolve => {
        this.watch(select, resolve, true, true);
      });
  }

  public effect = (
    callback: EffectCallback<any>,
    select?: string[] | Query) => {
    
    let target = this.subject;
    const effect = createEffect(callback);
    const invoke = debounce(() => effect(target));

    if(select)
      return this.watch(select, invoke, true);

    return this.do(() => {
      const sub = new Subscriber(target, invoke);
      effect(target = sub.proxy);
      return sub.listen();
    });
  }

  public import = (
    from: BunchOf<any>,
    select?: Iterable<string> | Query) => {

    const selected = select
      ? this.select(select)
      : keys(this.state);

    for(const key of selected)
      if(key in from)
        (this.subject as any)[key] = from[key];
  }

  public export = (
    select?: Iterable<string> | Query) => {

    if(!select)
      return assign({}, this.state);

    const data = {} as BunchOf<any>;

    for(const key of this.select(select))
      data[key] = (this.subject as any)[key];

    return data;
  }

  public update = (
    select: string | string[] | Query) => {

    for(const key of this.select(select))
      super.update(key);
  }

  public requestUpdate = (
    argument?: RequestCallback | boolean) => {

    const { pending, waiting } = this;

    if(fn(argument))
      waiting.push(argument)
    else if(!pending === argument)
      return Promise.reject(Oops.StrictUpdate())
    else if(pending)
      return new Promise(cb => waiting.push(cb));
    else
      return Promise.resolve(false);
  }
}