import type Public from '../types';

import { issues } from './issues';
import { lifecycleEvents } from './lifecycle';
import { CONTROL, LOCAL, Stateful } from './model';
import { Observer } from './observer';
import {
  assign,
  createEffect,
  defineProperty,
  fn,
  getOwnPropertyDescriptor,
  getOwnPropertyNames,
  selectRecursive,
} from './util';
import { Subscriber } from './subscriber';

export const Oops = issues({
  StrictUpdate: (expected) => 
    `Strict requestUpdate() did ${expected ? "not " : ""}find pending updates.`
})

const Pending = new WeakSet<Function>();

export function set(
  instruction: Public.Instruction<any>){

  Pending.add(instruction);
  return instruction as any;
}

export function setup(
  key: string,
  on: Controller,
  using: Public.Instruction<any>){

  delete (on.subject as any)[key];

  let describe = using(on, key);

  if(fn(describe)){
    const handle = describe as (sub: Subscriber | undefined) => any;
    const current = getOwnPropertyDescriptor(on.subject, key) || {};

    describe = assign(current, {
      get(this: Stateful){
        return handle(this[LOCAL]);
      }
    });
  }

  if(describe)
    defineProperty(on.subject, key, describe);
}

export class Controller extends Observer {
  static ensure(from: Stateful){
    return from[CONTROL];
  }

  public do(fun: () => Callback){
    return fun();
  }

  public add(
    key: string,
    desc: PropertyDescriptor){

    if(Pending.has(desc.value))
      setup(key, this, desc.value);
    else
      super.add(key, desc);
  }

  public watch(
    selection: string | Iterable<string> | Query,
    handler: any,
    squash?: boolean,
    once?: boolean){

    return this.do(() =>
      super.watch(
        keys(this, selection),
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
    const invoke = () => effect(target);

    if(select)
      return this.watch(select, invoke, true);

    return this.do(() => {
      const sub = this.subscribe(invoke);
      effect(target = sub.proxy);
      return sub.commit();
    });
  }

  public import = (
    from: BunchOf<any>,
    select?: Iterable<string> | Query) => {

    for(const key of keys(this, select))
      if(key in from)
        (this.subject as any)[key] = from[key];
  }

  public export = (
    select?: Iterable<string> | Query) => {

    const data = {} as BunchOf<any>;

    for(const key of keys(this, select))
      data[key] = (this.state as any)[key];

    return data;
  }

  public update = (
    select: string | string[] | Query) => {

    for(const key of keys(this, select))
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

function keys(
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