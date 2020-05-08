import { FunctionComponent, Context } from 'react';

import { ControlProvider, getterFor, ownContext, ASSIGNED_CONTEXT } from './context';
import { Singleton } from './control-global';
import { controllerIsGlobalError, GLOBAL_INSTANCE, globalController } from './global';
import { ControlledInput, ControlledValue } from './hoc';
import { createWrappedComponent } from './provider';
import { useOwnController, useSubscriber } from './subscriber';
import { BunchOf, Class, InstanceController, ModelController, SlaveController } from './types';
import { define, defineOnAccess } from './util';
import { useWatchedProperty, useWatcher } from './watcher';

export interface Controller 
  extends ModelController, InstanceController, SlaveController {

  // Extended classes represent the onion-layers of a given controller.
  // What is accessible depends on the context controller is accessed.
}

export class Controller {
  static global = false;
  static [GLOBAL_INSTANCE]?: Singleton;
  static [ASSIGNED_CONTEXT]?: Context<Controller>;

  static use(...args: any[]){
    if(this.global){
      const instance = globalController(this, args);
      return useSubscriber(instance!, args, true);
    }
    else
      return useOwnController(this, args);
  }

  static get(key?: string){
    const getInstance = getterFor(this)
    const hook = key === undefined ? 
      () => Object.create(getInstance()) : 
      (key: string) => (getInstance() as any)[key];
  
    define(this, "get", hook);
    return hook(key!) as unknown;
  }

  static tap(key?: string, main?: boolean){
    const instance = getterFor(this)();
    //TODO: Implement better caching here
  
    return key ?
      useWatchedProperty(instance, key, main) :
      useWatcher(instance);
  }

  static has(key: string){
    const getInstance = getterFor(this)
    const hook = (key: string) =>
      useWatchedProperty(getInstance(), key, true);
  
    define(this, "has", hook);
    return hook(key) as unknown;
  }

  static sub(...args: any[]){
    const getInstance = getterFor(this, args);
    const hook = (...args: any[]) => {
      const controller = getInstance();
      return useSubscriber(controller, args, false);
    }
    
    define(this, "sub", hook);
    return hook.apply(null, args);
  }

  static hoc<T extends Class>(
    this: T, fn: FunctionComponent<InstanceType<T>>){

    return createWrappedComponent.call(this as any, fn as any)
  }

  static map(this: any, from: any[]){
    return from.map((item, index) => new this(item, index));
  }

  static assign(external: BunchOf<any>){
    return this.tap().assign(external);
  }

  static makeGlobal(...args: any[]){
    this.global = true;
    return globalController(this, args);
  }

  static context(){
    if(this.global)
      throw controllerIsGlobalError(this.name)
    else
      return ownContext(this)
  }

  static get Provider(){
    if(this.global)
      throw controllerIsGlobalError(this.name)
    else 
      return useOwnController(this).Provider
  }

  onChange(
    key: string | string[], 
    listener?: (changed: string[]) => void){
  
    if(listener)
      this.observe(key as any, listener, true);
    else {
      return new Promise(resolve => {
        this.observe(key as any, resolve, true);
      })
    }
  }

  tap(key?: string, main?: boolean){
    return key ? 
      useWatchedProperty(this, key, main) : 
      useWatcher(this);
  }

  sub(...args: any[]){
    return useSubscriber(this, args, true) 
  }
}

defineOnAccess(Controller.prototype, "Provider", ControlProvider)
defineOnAccess(Controller.prototype, "Value", ControlledValue)
defineOnAccess(Controller.prototype, "Input", ControlledInput)