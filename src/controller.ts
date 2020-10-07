import type { FunctionComponent, ProviderProps } from 'react';

import { ControlledInput, ControlledValue } from './components';
import { useSubscriber, useController, usePassive, useWatcher } from './hooks';
import { LifecycleMethods } from './lifecycle';
import { observe, Observer } from './observer';
import { ControlProvider, getFromContext } from './context';
import { assignSpecific, defineLazy, getPrototypeOf } from './util';

import Oops from './issues';

export type Model = typeof Controller;

export interface Controller 
  extends LifecycleMethods {

  // via Observer.mixin
  on(key: string, value: any): Callback;
  once(key: string, value: any): Callback;
  update(entries: Partial<this>): void;

  // via defineLazy
  Input: FunctionComponent<{ to: string }>;
  Value: FunctionComponent<{ of: string }>;
  Provider: FunctionComponent<ProviderProps<this>>;
}

export class Controller {

  static use(...args: any[]){
    return useController(this, args);
  }

  static uses(
    props: BunchOf<any>, 
    only?: string[]){
      
    return useController(this, undefined, instance => {
      assignSpecific(instance, props, only);
    })
  }

  static using(
    props: BunchOf<any>, 
    only?: string[]){

    function assignTo(instance: Controller){
      assignSpecific(instance, props, only);
    }

    const subscriber = useController(
      this, undefined, assignTo
    );

    assignTo(subscriber);
        
    return subscriber;
  }

  static get(key?: string){
    return usePassive(this.find(), key);
  }

  public tap(...path: maybeStrings){
    return useWatcher(this, ...path);
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

  public sub(...args: any[]){
    return useSubscriber(this, args);
  }

  static sub(...args: any[]){
    return this.find().sub(...args);
  }

  static meta(...path: maybeStrings): any {
    return useWatcher(this, ...path);
  }

  static find(){
    return getFromContext(this);
  }

  static create<T extends Class>(
    this: T,
    args?: any[],
    prepare?: (self: InstanceType<T>) => void){

    const instance: InstanceType<T> = 
      new (this as any)(...args || []);

    if(prepare)
      prepare(instance);

    observe(instance);
    
    return instance;
  }

  public destroy(){
    const dispatch = observe(this);

    if(this.willDestroy)
      this.willDestroy();

    if(dispatch)
      dispatch.emit("willDestroy");
  }

  /** When Observer attaches to instance */
  public applyDispatch(observer: Observer){
    observer.monitorValues();
    observer.monitorComputed(Controller);
    observer.mixin();
  
    if(this.didCreate)
      this.didCreate();
  }

  /** When Observer attaches to the meta */
  static applyDispatch(observer: Observer){
    observer.monitorValues(Function);
    observer.monitorComputed(Controller);
    observer.mixin();
  }

  static isTypeof<T extends Class>(
    this: T, maybe: any): maybe is T {

    return (
      !!maybe && 
      typeof maybe == "object" && 
      maybe.prototype instanceof this
    )
  }

  static get inherits(): typeof Controller | undefined {
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