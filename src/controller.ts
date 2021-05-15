import type { Controller as Public } from '..';

import { createBindAgent } from './binding';
import { Context } from './context';
import { Dispatch } from './dispatch';
import { useController, useMemoized, usePassive, useSubscriber, useWatcher } from './hooks';
import { assignSpecific, define, entriesIn, fn, getPrototypeOf } from './util';

import Oops from './issues';

export type Model = typeof Controller;

export interface Controller extends Public {};

export class Controller {
  constructor(){
    const cb = this.didCreate && this.didCreate.bind(this);
    const dispatch = new Dispatch(this, Controller, cb);

    define(this, { get: this, set: this });

    for(const [key, { value }] of entriesIn(dispatch))
      if(fn(value))
        define(this, key, value);
  }

  public tap(path?: string | SelectFunction<any>){
    return useWatcher(this, path) as any;
  }

  public sub(...args: any[]){
    return useSubscriber(this, args) as any;
  }

  public get bind(){
    return createBindAgent(this) as any;
  }

  public destroy(){
    const dispatch = Dispatch.get(this);

    if(this.willDestroy)
      this.willDestroy();

    if(dispatch)
      dispatch.emit("willDestroy");
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

    const subscriber = useController(this, []);

    assignSpecific(subscriber, props, only);
        
    return subscriber;
  }

  static memo(...args: any[]){
    return useMemoized(this, args);
  }

  static get(key?: string | SelectFunction<any>){
    return usePassive(this.find(), key);
  }

  static tap(key?: string | SelectFunction<any>){
    return this.find().tap(key);
  }

  static has(key: string){
    const value = this.find().tap(key);

    if(value === undefined)
      throw Oops.HasPropertyUndefined(this.name, key);

    return value;
  }

  static sub(...args: any[]){
    return this.find().sub(...args);
  }

  static meta(path: string | SelectFunction<any>): any {
    return useWatcher(() => {
      Dispatch.ensure(this, Controller);
      return this;
    }, path);
  }

  static find(){
    const instance = Context.useLayer().get(this);
  
    if(!instance)
      throw Oops.NothingInContext(this.name);
  
    return instance;
  }

  static create<T extends Model>(
    this: T,
    args?: any[],
    prepare?: (self: InstanceOf<T>) => void){

    const instance: InstanceOf<T> = 
      new (this as any)(...args || []);

    Dispatch.get(instance);

    if(prepare)
      prepare(instance);

    return instance;
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