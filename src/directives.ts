import type { ComponentType } from 'react';
import type { ControllableRefFunction } from '..';
import type { Controller, Model } from './controller';

import { boundRefComponent, createHocFactory, withProvider } from './components';
import { Dispatch, createEffect } from './dispatch';
import { Singleton } from './singleton';
import { define, defineLazy, defineProperty, within } from './util';

import Oops from './issues';

export class Pending {
  constructor(
    public applyTo: (recipient: Dispatch, key: string) => void,
    public loose?: boolean
  ){}
}

const ParentRelationship = new WeakMap<{}, {}>();

export function childProperty<T extends Model>
  (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  function bindChild(on: Dispatch, key: string){
    const parent = on.subject;
    const instance = new Peer() as InstanceOf<T>;

    define(parent, key, instance);
    ParentRelationship.set(instance, parent);

    Dispatch.get(instance);

    if(callback)
      callback(instance);
  }

  return new Pending(bindChild) as any;
}

export function parentProperty<T extends Model>
  (Expects: T, required?: boolean): InstanceOf<T> {

  function attachParent(on: Dispatch, key: string){
    const { subject } = on;
    const { name: expectsType } = Expects;
    const { name: onType } = subject.constructor;
    const parent = ParentRelationship.get(subject);

    if(!parent){
      if(required)
        throw Oops.ParentRequired(expectsType, onType);
    }
    else if(!(parent instanceof Expects)){
      const gotType = parent.constructor.name;
      throw Oops.UnexpectedParent(expectsType, onType, gotType);
    }

    define(subject, key, parent);
  }

  return new Pending(attachParent) as any;
}

export function peerProperty<T extends Model>
  (Peer: T): InstanceOf<T> {

  function bindSibling(on: Dispatch, key: string){
    const subject = on.subject as Controller;

    if(Singleton.isTypeof(Peer))
      defineLazy(subject, key, () => Peer.find());
    else if(subject instanceof Singleton)
      throw Oops.CantAttachGlobal(subject.constructor.name, Peer.name);
    else
      define(subject, key, Peer);
  }

  return new Pending(bindSibling) as any;
}

export function refProperty<T = any>
  (effect?: EffectCallback<Controller, any>): RefObject<T> {

  function createReference(on: Dispatch, key: string){
    const reset = effect && createEffect(effect);
    const value = defineProperty({}, "current", {
      get: () => on.state[key],
      set: (value: any) => {
        if(on.set(key, value) && reset)
          reset(value, on.subject);
      }
    });

    on.monitor(key);
    defineProperty(on.subject, key, {
      enumerable: true,
      value
    });
  }

  return new Pending(createReference) as any;
}

export function effectProperty<T = any>
  (effect: EffectCallback<Controller, any>): T {

  function registerEffect(on: Dispatch, key: string){
    const reset = createEffect(effect);

    on.monitor(key);
    defineProperty(on.subject, key, {
      enumerable: true,
      get: () => on.state[key],
      set: (value: any) => {
        if(on.set(key, value))
          reset(value, on.subject);
      }
    });
  }

  return new Pending(registerEffect) as any;
}

export function eventProperty
  (callback?: EffectCallback<Controller>){

  function registerEvent(on: Dispatch, key: string){
    const trigger = () => on.emit(key);

    on.monitor(key);
    defineProperty(on.subject, key, {
      get: () => trigger,
      set: () => {
        throw Oops.AccessEvent(on.subject.constructor.name, key);
      }
    })

    if(callback)
      on.effect(callback, [key]);
  }

  return new Pending(registerEvent) as any;
}

export function memoizedProperty
  (factory: () => any, defer?: boolean){

  function memoizeValue(on: Dispatch, key: string){
    const get = () => factory.call(on.subject);

    if(defer)
      defineLazy(on.subject, key, get);
    else
      define(on.subject, key, get())
  }
    
  return new Pending(memoizeValue) as any;
}

export function componentProperty
  (Type: ComponentType){

  const componentFor = createHocFactory(Type);

  function assignComponent(on: Dispatch, key: string){
    defineLazy(on.subject, key, () => {
      return componentFor(on.subject as Controller)
    })
  }
    
  return new Pending(assignComponent) as any;
}

export function parentComponentProperty
  (Type: ComponentType){

  const componentFor = createHocFactory(Type);

  function assignProvider(on: Dispatch, key: string){
    defineLazy(on.subject, key, () => {
      const control = on.subject as Controller;
      const Component = componentFor(control);
      return withProvider(Component, control)
    })
  }
    
  return new Pending(assignProvider) as any;
}

export function boundComponentProperty
  (Type: ControllableRefFunction<HTMLElement>, to: string){

  function createBinding(on: Dispatch, key: string){
    const control = on.subject as Controller;
    const Component = boundRefComponent(control, to, Type);
    define(control, key, Component);
  }
    
  return new Pending(createBinding) as any;
}

export function defineValueProperty(value: any){
  function setDefault(on: Dispatch, key: string){
    on.monitorValue(key, value);
  }

  return new Pending(setDefault, true) as any;
}

export function passiveProperty(value: any){
  function assign(on: Dispatch, key: string){
    within(on.subject, key, value);
  }

  return new Pending(assign);
}

export function tupleProperty<T extends any[]>
  (...values: T): T {

  if(values.length == 0)
    values = undefined as any;
  else if(values.length == 1 && typeof values[0] == "object")
    values = values[0] as any;
  
  function assign(on: Dispatch, key: string){
    on.monitorValue(key, values, (next: any) => {
      const current: any = on.state[key];
      let update = false;

      if(!current){
        update = true;
        on.state[key] = current;
      }
      else 
        for(const k in current)
          if(current[k] !== next[k]){
            current[k] = next[k];
            update = true;
          }

      if(update)
        on.emit(key);
    });
  }

  return new Pending(assign) as any;
}