import { issues } from './issues';
import { lifecycleEvents } from './lifecycle';
import { Observer } from './observer';
import { extracts, LOCAL, Subscriber } from './subscriber';
import { createEffect, debounce, defineLazy, fn, getOwnPropertyNames, selectRecursive } from './util';

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict requestUpdate() did ${expected ? "not " : ""}find pending updates.`
})

const Pending = new WeakSet<Function>();

type Sets = (key: string, on: Observer) => void;
type Gets = (key: string, on: Observer, within?: Subscriber) => void;

export function set(instruction: Sets){
  Pending.add(instruction);
  return instruction as any;
}

export function get(instruction: Gets){
  return set((key, on) => {
    defineLazy(on.subject, key, 
      extracts(sub => instruction(key, on, sub))  
    );
  })
}

export const CONTROL = Symbol("controller");

export interface Stateful {
  [CONTROL]: Controller
  [LOCAL]?: Subscriber;
};

export class Controller extends Observer {
  static ensure(from: Stateful){
    return from[CONTROL];
  }

  public do(fn: () => Callback){
    return fn();
  }

  public setup(
    key: string,
    desc: PropertyDescriptor){

    if(Pending.has(desc.value))
      desc.value(key, this);
    else
      super.setup(key, desc);
  }

  public select(
    using?: string | Iterable<string> | Query){

    const keys = getOwnPropertyNames(this.state);

    if(!using)
      return keys;

    if(typeof using == "string")
      return [ using ];

    if(fn(using))
      return selectRecursive(using,
        keys.concat(lifecycleEvents)
      );

    return Array.from(using);
  }

  public watch(
    target: string | Iterable<string> | Query,
    handler: any,
    squash?: boolean,
    once?: boolean){

    return this.do(() =>
      super.watch(
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

    const keys = this.select(select);

    for(const key of keys)
      if(key in from)
        (this.subject as any)[key] = from[key];
  }

  public export = (
    select?: Iterable<string> | Query) => {

    const keys = this.select(select);
    const data = {} as BunchOf<any>;

    for(const key of keys)
      data[key] = (this.state as any)[key];

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
      return Promise.reject(Oops.StrictUpdate(argument))
    else if(pending)
      return new Promise(cb => waiting.push(cb));
    else
      return Promise.resolve(false);
  }
}