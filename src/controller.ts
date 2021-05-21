import type { Controller as Public } from '..';

import { createBindAgent } from './binding';
import { Context } from './context';
import { Dispatch } from './dispatch';
import { useController, useLazy, usePassive, useSubscriber, useWatcher } from './hooks';
import { assignSpecific, define, entriesIn, fn, getPrototypeOf } from './util';

import Oops from './issues';

export type Model = typeof Controller;

export interface Controller extends Public {};

export class Controller {
  constructor(){
    const cb = this.didCreate;
    const dispatch = new Dispatch(this, Controller);

    if(cb)
      dispatch.requestUpdate(cb.bind(this));

    define(this, { get: this, set: this });

    for(const [key, { value }] of entriesIn(dispatch))
      if(fn(value))
        define(this, key, value);
  }

  public get bind(){
    const agent = createBindAgent(this);
    define(this.get, { bind: agent });
    return agent as any;
  }

  public tap(path?: string | SelectFunction<any>){
    return useWatcher(this, path) as any;
  }

  public sub(...args: any[]){
    return useSubscriber(this, args) as any;
  }

  public destroy(){
    this.declare("willDestroy");
  }

  static create<T extends Model>(
    this: T, ...args: any[]){

    const instance: InstanceOf<T> = 
      new (this as any)(...args);

    Dispatch.for(instance);

    return instance;
  }

  static use(...args: any[]){
    return useController(this, args);
  }

  static uses(
    props: BunchOf<any>, 
    only?: string[]){
      
    return useController(this, [], instance => {
      assignSpecific(instance, props, only);
    })
  }

  static using(
    props: BunchOf<any>, 
    only?: string[]){

    const instance = useController(this, []);

    assignSpecific(instance, props, only);

    return instance;
  }

  static memo(...args: any[]){
    return useLazy(this, args);
  }

  static get(key?: boolean | string | SelectFunction<any>){
    return usePassive(this, key);
  }

  static tap(key?: string | SelectFunction<any>){
    return this.find(true).tap(key);
  }

  static has(key: string){
    const value = this.tap(key);

    if(value === undefined)
      throw Oops.HasPropertyUndefined(this.name, key);

    return value;
  }

  static sub(...args: any[]){
    return this.find(true).sub(...args);
  }

  static meta(path: string | SelectFunction<any>): any {
    return useWatcher(() => {
      Dispatch.ensure(this, Controller);
      return this;
    }, path);
  }

  static find(strict: true): Controller;
  static find(strict?: boolean): Controller | undefined;
  static find(strict?: boolean){
    return Context.useAmbient().get(this, strict);
  }

  static isTypeof<T extends Model>(
    this: T, maybe: any): maybe is T {

    return (
      fn(maybe) && 
      maybe.prototype instanceof this
    )
  }

  static get inherits(): Model | undefined {
    const I = getPrototypeOf(this);

    if(I !== Controller)
      return I;
  }
}