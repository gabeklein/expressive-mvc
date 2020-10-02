import { FunctionComponent, ProviderProps } from 'react';

import { ControlledInput, ControlledValue } from './components';
import { LifecycleMethods } from './lifecycle';
import { Observer } from './observer';
import { TEMP_CONTEXT } from './peers';
import { ControlProvider, createWrappedComponent, getFromContext } from './provider';
import { useActiveSubscriber, useOwnController, usePassiveGetter, usePassiveSubscriber } from './subscriber';
import { assignSpecific, defineLazy, Issues } from './util';

const Oops = Issues({
  HasPropertyUndefined: (control, property) =>
    `${control}.${property} is marked as required for this render.`
});

export interface Controller 
  extends LifecycleMethods {

  __dispatch__: Observer;
  [TEMP_CONTEXT]: Callback;

  on(key: string, value: any): Callback;
  once(key: string, value: any): Callback;
  update(entries: Partial<this>): void;

  Input: FunctionComponent<{ to: string }>;
  Value: FunctionComponent<{ of: string }>;
  Provider: FunctionComponent<ProviderProps<this>>;
}

export class Controller {
  tap(...path: maybeStrings){
    return usePassiveSubscriber(this, ...path);
  }

  sub(...args: any[]){
    return useActiveSubscriber(this, args);
  }

  destroy(){
    const dispatch = this.__dispatch__;

    if(dispatch)
      dispatch.emit("willDestroy");
    
    if(this.willDestroy)
      this.willDestroy();
  }

  static __dispatch__: Observer;

  static hoc = createWrappedComponent;

  static get Provider(){
    return useOwnController(this).Provider;
  }

  static isTypeof<T extends Class>(this: T, maybe: any): maybe is T {
    return (
      !!maybe && 
      typeof maybe == "object" && 
      maybe.prototype instanceof this
    )
  }

  static find(){
    return getFromContext(this);
  }

  static meta(...path: maybeStrings): any {
    return usePassiveSubscriber(this, ...path);
  }

  static create<T extends Class>(
    this: T,
    args?: any[],
    prepare?: (self: InstanceType<T>) => void){

    const instance: InstanceType<T> = 
      new (this as any)(...args || []);

    if(prepare)
      prepare(instance);

    instance.__dispatch__;
    
    return instance;
  }

  static use(...args: any[]){
    return useOwnController(this, args);
  }

  static uses(
    props: BunchOf<any>, 
    only?: string[]){
      
    return useOwnController(this, undefined, instance => {
      assignSpecific(instance, props, only);
    })
  }

  static using(
    props: BunchOf<any>, 
    only?: string[]){

    function assignTo(instance: Controller){
      assignSpecific(instance, props, only);
    }

    const subscriber = useOwnController(this, undefined, assignTo);

    assignTo(subscriber);
        
    return subscriber;
  }

  static get(key?: string){
    return usePassiveGetter(this.find(), key);
  }

  static tap(...keys: maybeStrings){
    return this.find().tap(...keys);
  }

  static has(key: string){
    const value = this.tap(key);

    if(value === undefined)
      throw Oops.HasPropertyUndefined(this.name, key);

    return value;
  }

  static sub(...args: any[]){
    const instance = this.find();
    return useActiveSubscriber(instance, args);
  }
}

defineLazy(Controller, {
  __dispatch__(){
    const observer = new Observer(this)
  
    observer.monitorValues(Function);
    observer.monitorComputed(Controller);
    observer.mixin();
  
    return observer;
  }
});

defineLazy(Controller.prototype, {
  Provider: ControlProvider,
  Value: ControlledValue,
  Input: ControlledInput,
  __dispatch__(){
    const observer = new Observer(this);
  
    observer.monitorValues();
    observer.monitorComputed(Controller);
    observer.mixin();
  
    if(this.didCreate)
      this.didCreate();
  
    return observer;
  }
});