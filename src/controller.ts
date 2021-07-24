import { runInstruction } from "./instructions";
import { issues } from './issues';
import { lifecycleEvents } from './lifecycle';
import { CONTROL, Stateful } from './model';
import { Observer } from './observer';
import { createEffect, fn, getOwnPropertyNames, selectRecursive } from './util';

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict requestUpdate() did ${expected ? "not " : ""}find pending updates.`
})

export class Controller extends Observer {
  static ensure(from: Stateful){
    return from[CONTROL];
  }

  public do(fun: () => Callback){
    return fun();
  }

  public add(key: string, handle?: Observer.Handle){
    super.add(key, handle || runInstruction);
  }

  public on = (
    select: string | Iterable<string> | Query,
    listener: UpdateCallback<any, any>,
    squash?: boolean,
    once?: boolean) => {

    return this.do(() =>
      this.watch(
        selection(this, select), listener, squash, once
      )
    );
  }

  public once = (
    select: string | Iterable<string> | Query,
    listener?: UpdateCallback<any, any>,
    squash?: boolean) => {

    if(listener)
      return this.on(select, listener, squash, true);
    else 
      return new Promise<void>(resolve => {
        this.on(select, resolve, true, true);
      });
  }

  public effect = (
    callback: EffectCallback<any>,
    select?: string[] | Query) => {
    
    let target = this.subject;
    const effect = createEffect(callback);
    const invoke = () => effect(target);

    if(select)
      return this.on(select, invoke, true);

    return this.do(() => {
      const sub = this.subscribe(invoke);
      effect(target = sub.proxy);
      return sub.commit();
    });
  }

  public import = (
    from: BunchOf<any>,
    select?: Iterable<string> | Query) => {

    for(const key of selection(this, select))
      if(key in from)
        (this.subject as any)[key] = from[key];
  }

  public export = (
    select?: Iterable<string> | Query) => {

    const data = {} as BunchOf<any>;

    for(const key of selection(this, select))
      data[key] = (this.state as any)[key];

    return data;
  }

  public update = (
    select: string | string[] | Query) => {

    for(const key of selection(this, select))
      super.update(key);
  }

  public requestUpdate = (
    argument?: RequestCallback | boolean) => {

    const { pending, waiting } = this;

    if(fn(argument))
      waiting.push(argument)
    else if(!pending === argument)
      return Promise.reject(Oops.StrictUpdate(argument))
    else if(pending)
      return new Promise(cb => waiting.push(cb));
    else
      return Promise.resolve(false);
  }
}

function selection(
  on: Controller,
  using?: string | Iterable<string> | Query){

  if(typeof using == "string")
    return [ using ];

  const keys = getOwnPropertyNames(on.state);

  if(!using)
    return keys;

  if(fn(using))
    return selectRecursive(using,
      keys.concat(lifecycleEvents)
    );

  return Array.from(using);
}