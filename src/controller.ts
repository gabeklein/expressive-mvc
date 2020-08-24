import { Context, createContext, FunctionComponent, ProviderProps, useContext } from 'react';

import { ControlledInput, ControlledValue } from './components';
import { ControllerDispatch } from './dispatch';
import { createWrappedComponent } from './hoc';
import { getObserver, Observable, OBSERVER, Observer } from './observer';
import { TEMP_CONTEXT } from './peers';
import { CONTEXT_MULTIPROVIDER, ControlProvider } from './provider';
import { useLazySubscriber, useModelController, useSubscriber } from './subscriber';
import { define, defineOnAccess } from './util';

/** 
 * Helper generic, allows errors-free access 
 * to arbitrary properties in an object. 
 */
export type Any<T extends Controller = any> = { [key: string]: any };

/**
 * Abstract "Type-Waiver" for controller.
 * Prevent compiler from complaining about arbitary property access.
 */
export function within<T extends Controller>(controller: T): Any<T>;
export function within<T extends Controller>(controller: T, key: string): any;
export function within<T extends Controller, V>(controller: T, key: string, value: V): V;

export function within(controller: Controller, key?: string, value?: any){
  const target = controller as any;
  if(value)
    return target[key!] = value;
  if(key)
    return target[key];
  else
    return target;
}

export interface ModelController {
  [TEMP_CONTEXT]: Callback;

  didCreate?(): void;
  didFocus?(parent: ModelController, as: string): void;
  didMount?(...args: any[]): void;
  didRender?(...args: any[]): void;

  willReset?(...args: any[]): void;
  willDestroy?(callback?: Callback): void;
  willLoseFocus?(parent: ModelController, as: string): void;
  willMount?(...args: any[]): void;
  willRender?(...args: any[]): void;
  willUnmount?(...args: any[]): void;
  willUpdate?(...args: any[]): void;
  willCycle?(...args: any[]): Callback;

  elementDidMount?(...args: any[]): void;
  elementWillMount?(...args: any[]): void;
  elementWillRender?(...args: any[]): void;
  elementWillUnmount?(...args: any[]): void;
  elementWillUpdate?(...args: any[]): void;
  elementWillCycle?(...args: any[]): Callback;

  componentDidMount?(...args: any[]): void;
  componentWillMount?(...args: any[]): void;
  componentWillRender?(...args: any[]): void;
  componentWillUnmount?(...args: any[]): void;
  componentWillUpdate?(...args: any[]): void;
  componentWillCycle?(...args: any[]): Callback;
}

export interface Controller 
  extends Observable, ModelController {

  [OBSERVER]: ControllerDispatch;

  get: this;
  set: this;

  Input: FunctionComponent<{ to: string }>;
  Value: FunctionComponent<{ of: string }>;
  Provider: FunctionComponent<ProviderProps<this>>;

  assign(props: BunchOf<any>): this;
  assign(key: string, props?: BunchOf<any>): any;

  tap(): this;
  tap<K extends keyof this>(key?: K): this[K];
}

export class Controller {
  constructor(){
    this.get = this;
    this.set = this;
  }

  ensureDispatch(){
    return ControllerDispatch.applyTo(this);
  }

  tap(key?: string){
    const self = useLazySubscriber(this);
    return key ? self[key] : key;
  }

  sub(...args: any[]){
    return useSubscriber(this, args, false) 
  }
  
  assign(
    a: string | BunchOf<any>, 
    b?: BunchOf<any>){
  
    if(typeof a == "string")
      return within(this, a, b);
    else
      return Object.assign(this, a) as this;
  }

  toggle = (key: string) => {
    const self = this as any;
    return self[key] = !self[key];
  }

  export = (
    subset?: string[] | Callback, 
    onChange?: Callback | boolean,
    initial?: boolean) => {

    const dispatch = getObserver(this);

    if(typeof subset == "function"){
      initial = onChange as boolean;
      onChange = subset;
      subset = dispatch.managed;
    }
  
    if(typeof onChange == "function")
      return dispatch.feed(subset!, onChange, initial);
    else 
      return dispatch.pick(subset);
  }

  attach(key: string, type: typeof Controller){
    if(!type.context)
      defineOnAccess(this, key, () => type.find());
  }

  destroy(){
    const dispatch = this[OBSERVER];

    if(dispatch)
      dispatch.trigger("willDestroy");
    
    if(this.willDestroy)
      this.willDestroy();
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

  static context?: Context<Controller>;
  static find: () => Controller;
  static meta: <T>(this: T) => T & Observable;

  static create<T extends Class>(
    this: T, args: any[]): InstanceType<T> {

    return new (this as any)(...args);
  }

  static get(): Controller;
  static get(key?: string){
    const instance = this.find();
    return key ? within(instance, key) : instance;
  }

  static tap(): Controller;
  static tap(key?: string){
    return this.find().tap(key);
  }

  static has(key: string){
    const value = this.find().tap(key);

    if(value === undefined)
      throw new Error(`${this.name}.${key} is marked as required for this render.`)

    return value;
  }

  static sub(...args: any[]){
    const instance = this.find();
    return useSubscriber(instance, args, false);
  }

  static hoc = createWrappedComponent;

  static assign(a: string | BunchOf<any>, b?: BunchOf<any>){
    const instance = this.find();
    instance.assign(a, b);
    return instance.tap();
  }

  static use(...args: any[]){
    return useModelController(this, args);
  }

  static uses(
    props: BunchOf<any>, 
    only?: string[]){
      
    return useModelController(this, [], (instance) => {
      instance.integrate(props, only);
    })
  }

  static using(
    props: BunchOf<any>, 
    only?: string[]){

    function assignTo(instance: Controller){
      instance.integrate(props, only);
    }

    const subscriber = useModelController(this, [], assignTo);

    assignTo(subscriber);
        
    return subscriber;
  }

  static get Provider(){
    return useModelController(this).Provider;
  }
}

defineOnAccess(Controller, "context", 
  () => createContext<any>(null)
);

defineOnAccess(Controller, "find", 
  function getterForContext(this: typeof Controller) {
    const { name, context } = this;

    return function useInstanceInContext(){
      const instance = 
        useContext(context!) || 
        useContext(CONTEXT_MULTIPROVIDER)[name];

      if(!instance)
        throw new Error(
          `Can't subscribe to controller; this accessor ` + 
          `can only be used within a Provider keyed to \`${name}\``
        );

      return instance;
    }
  }
);

defineOnAccess(Controller, "meta", 
  function getterForMeta(this: typeof Controller){
    const self = this as unknown as Observable;
    const observer = new Observer(self);

    observer.monitorValues(["prototype", "length", "name"]);
    observer.monitorComputed();

    define(self, {
      get: self,
      set: self
    });

    return () => useLazySubscriber(self);
  }
);

defineOnAccess(Controller.prototype, "Provider", ControlProvider);
defineOnAccess(Controller.prototype, "Value", ControlledValue);
defineOnAccess(Controller.prototype, "Input", ControlledInput);