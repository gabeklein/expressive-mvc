import type { Controller as Public } from '../';
import type { ComponentType } from 'react';

import { derivedConsumer, derivedProvider } from './hoc';
import { ControlledInput, ControlledValue } from './components';
import { useSubscriber, useController, usePassive, useWatcher } from './hooks';
import { Observer } from './observer';
import { ControlProvider, getFromContext } from './context';
import { assignSpecific, defineLazy, getPrototypeOf, define, memoize } from './util';

import Oops from './issues';

export type Model = typeof Controller;
export type State<T extends Model> = InstanceOf<T>;

export interface Controller extends Public {};

export class Controller {
  constructor(){
    define(this, { get: this, set: this });
    Observer.apply(this);
  }

  public tap(...path: maybeStrings){
    return useWatcher(this, ...path);
  }

  public sub(...args: any[]){
    return useSubscriber(this, args);
  }

  public destroy(){
    const dispatch = Observer.get(this);

    if(this.willDestroy)
      this.willDestroy();

    if(dispatch)
      dispatch.emit("willDestroy");
  }

  /** When Observer attaches to instance */
  public applyDispatch(observer: Observer){
    observer.monitorValues({ get: 0, set: 0, Provider: 0 });
    observer.monitorComputed(Controller);
  
    if(this.didCreate)
      this.didCreate();
  }

  /** When Observer attaches to the meta */
  static applyDispatch(observer: Observer){
    observer.monitorValues(Function);
    observer.monitorComputed(Controller);
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
    return useWatcher(this, ...path);
  }

  static hoc(Type: ComponentType){
    return memoize(derivedConsumer, this, Type);
  }

  static wrap(Type: ComponentType){
    return memoize(derivedProvider, this, Type);
  }

  static find(){
    return getFromContext(this);
  }

  static create<T extends Model>(
    this: T,
    args?: any[],
    prepare?: (self: State<T>) => void){

    const instance: State<T> = 
      new (this as any)(...args || []);

    if(prepare)
      prepare(instance);

    Observer.get(instance);
    
    return instance;
  }

  static isTypeof<T extends Class>(
    this: T, maybe: any): maybe is T {

    return (
      typeof maybe == "function" && 
      maybe.prototype instanceof this
    )
  }

  static get inherits(): Model | undefined {
    const I = getPrototypeOf(this);
    if(I !== Controller)
      return I;
  }
}

defineLazy(Controller, {
  Provider: ControlProvider
});

defineLazy(Controller.prototype, {
  Provider: ControlProvider,
  Value: ControlledValue,
  Input: ControlledInput
});