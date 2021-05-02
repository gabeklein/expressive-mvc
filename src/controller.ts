import type { ControllableComponent, Controller as Public } from '../';
import type { FunctionComponent } from 'react';

import { createBindAgent } from './binding';
import { derivedConsumer, derivedProvider } from './components';
import { useSubscriber, useController, usePassive, useWatcher, useMemoized } from './hooks';
import { Dispatch } from './dispatch';
import { ControlProvider, getFromContext } from './context';
import { assignSpecific, defineLazy, getPrototypeOf, define, memoize, entriesIn } from './util';

import Oops from './issues';

export type Model = typeof Controller;

export interface Controller extends Public {};

export class Controller {
  constructor(){
    const cb = this.didCreate && this.didCreate.bind(this);
    const dispatch = new Dispatch(this, Controller, cb);

    define(this, { get: this, set: this });

    for(const [key, { value }] of entriesIn(dispatch))
      if(typeof value == "function")
        define(this, key, value);
  }

  public tap(...path: maybeStrings){
    return useWatcher(this, ...path);
  }

  public sub(...args: any[]){
    return useSubscriber(this, args);
  }

  public get bind(){
    return createBindAgent(this);
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

    function assign(instance: Controller){
      assignSpecific(instance, props, only);
    }

    const subscriber = 
      useController(this, [], assign);

    assign(subscriber);
        
    return subscriber;
  }

  static memo(...args: any[]){
    return useMemoized(this, args);
  }

  static get(key?: string){
    return usePassive(this.find(), key);
  }

  static tap(...keys: maybeStrings){
    return this.find().tap(...keys);
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

  static meta(...path: maybeStrings): any {
    return useWatcher(() => {
      Dispatch.ensure(this, Controller);
      return this;
    }, ...path);
  }

  static hoc<P>(
    Type: ControllableComponent<P>
  ): FunctionComponent<P> {
    return memoize(derivedConsumer, this, Type);
  }

  static wrap<P>(
    Type: ControllableComponent<P>
  ): FunctionComponent<P> {
    return memoize(derivedProvider, this, Type);
  }

  static find(){
    return getFromContext(this);
  }

  static create<T extends Model>(
    this: T,
    args?: any[],
    prepare?: (self: InstanceOf<T>) => void){

    const instance: InstanceOf<T> = 
      new (this as any)(...args || []);

    if(prepare)
      prepare(instance);

    Dispatch.get(instance);
    
    return instance;
  }

  static isTypeof<T extends Model>(
    this: T, maybe: any): maybe is T {

    return (
      typeof maybe == "function" && 
      maybe.prototype instanceof this
    )
  }

  static get inheriting(): Model | undefined {
    const I = getPrototypeOf(this);
    if(I !== Controller)
      return I;
  }
}

for(const to of [ Controller, Controller.prototype ])
  defineLazy(to, { Provider: ControlProvider });