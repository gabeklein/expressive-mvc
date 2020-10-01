import { Context, createContext, FunctionComponent, ProviderProps, useContext } from 'react';

import { ControlledInput, ControlledValue } from './components';
import { LifecycleMethods } from './lifecycle';
import { Observer } from './observer';
import { TEMP_CONTEXT } from './peers';
import { CONTEXT_MULTIPROVIDER, ControlProvider, createWrappedComponent } from './provider';
import { useActiveSubscriber, useOwnController, usePassiveGetter, usePassiveSubscriber } from './subscriber';
import { define, defineAtNeed, Issues, within } from './util';

export const OBSERVER = Symbol("object_observer");

const Oops = Issues({
  ContextNotFound: (name) =>
    `Can't subscribe to controller; this accessor can` +
    `only be used within a Provider keyed to ${name}.`,

  HasPropertyUndefined: (control, property) =>
    `${control}.${property} is marked as required for this render.`
});

export interface Controller 
  extends LifecycleMethods {

  [OBSERVER]: Observer;
  [TEMP_CONTEXT]: Callback;

  on(key: string, value: any): Callback;
  once(key: string, value: any): Callback;

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

  attach(key: string, type: typeof Controller){
    if(!type.context)
      defineAtNeed(this, key, () => type.find());
  }

  destroy(){
    const dispatch = this.getDispatch();

    if(dispatch)
      dispatch.emit("willDestroy");
    
    if(this.willDestroy)
      this.willDestroy();
  }

  getDispatch(){
    let dispatch = this[OBSERVER];

    if(!dispatch){
      dispatch = new Observer(this);
      dispatch.monitorValues();
      dispatch.monitorComputed(Controller);
    
      define(this, OBSERVER, dispatch);
      define(this, {
        on: dispatch.on,
        once: dispatch.once,
        update: dispatch.update,
        effect: dispatch.effect,
        export: dispatch.export
      })
    
      if(this.didCreate)
        this.didCreate();
    }
  
    return dispatch;
  }

  private integrate(
    source: BunchOf<any>, 
    only?: string[]){

    const pull = only || Object.keys(source);
    const setters: string[] = [];
    const values = within(this);

    for(const key of pull){
      const desc = Object.getOwnPropertyDescriptor(
        this.constructor.prototype, key
      );
      if(desc && desc.set)
        setters.push(key)
      else
        values[key] = source[key];
    }

    for(const key of setters)
      values[key] = source[key];
  }

  static [OBSERVER]: Observer;
  static context?: Context<Controller>;
  static meta: <T extends Class>(this: T) => InstanceType<T>;

  static hoc = createWrappedComponent;

  static get Provider(){
    return useOwnController(this).Provider;
  }

  static isTypeof(maybe: any): maybe is typeof Controller {
    return (
      !!maybe && 
      typeof maybe == "object" && 
      maybe.prototype instanceof Controller
    )
  }

  static find(){
    const instance = 
      useContext(this.context!) || 
      useContext(CONTEXT_MULTIPROVIDER)[this.name];

    if(!instance)
      throw Oops.ContextNotFound(this.name);

    return instance;
  }

  static create<T extends Class>(
    this: T,
    args?: any[],
    prepare?: (self: InstanceType<T>) => void){

    const instance: InstanceType<T> = 
      new (this as any)(...args || []);

    if(prepare)
      prepare(instance);

    instance.getDispatch();
    
    return instance;
  }

  static use(...args: any[]){
    return useOwnController(this, args);
  }

  static uses(
    props: BunchOf<any>, 
    only?: string[]){
      
    return useOwnController(this, undefined, 
      (instance) => instance.integrate(props, only)
    )
  }

  static using(
    props: BunchOf<any>, 
    only?: string[]){

    function assignTo(instance: Controller){
      instance.integrate(props, only);
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

  static getDispatch(){
    let observer = this[OBSERVER];

    if(!observer){
      observer = new Observer(this)
      observer.monitorValues(Function);
      observer.monitorComputed(Controller);
    
      define(this, OBSERVER, observer);
    }

    return observer;
  };
}

defineAtNeed(Controller, {
  context(){
    return createContext<any>(null);
  },
  meta(){
    return (...path: maybeStrings) => 
      usePassiveSubscriber(this, ...path);
  }
});

defineAtNeed(Controller.prototype, {
  Provider: ControlProvider,
  Value: ControlledValue,
  Input: ControlledInput
});