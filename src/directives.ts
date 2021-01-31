import type { ComponentType } from 'react';
import type { ControllableRefFunction } from '..';
import type { Controller, Model } from './controller';

import { boundRefComponent, createHocFactory, withProvider } from './components';
import { Dispatch } from './dispatch';
import { Singleton } from './singleton';
import { createEffect, define, defineLazy, defineProperty, within, displayName } from './util';

import Oops from './issues';

export class Pending {
  constructor(
    public applyTo: (this: Dispatch, key: string) => void,
    public loose?: boolean
  ){}
}

const ParentRelationship = new WeakMap<{}, {}>();

export function childProperty<T extends Model>
  (Peer: T, callback?: (i: InstanceOf<T>) => void): InstanceOf<T> {

  function bindChild(this: Dispatch, key: string){
    const parent = this.subject;
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

  function attachParent(this: Dispatch, key: string){
    const { subject } = this;
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

  function bindSibling(this: Dispatch, key: string){
    const subject = this.subject as Controller;

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

  function createReference(this: Dispatch, key: string){
    const reset = effect && createEffect(effect);

    this.register(key);
    this.override(key, {
      value: defineProperty({}, "current", {
        get: this.getter(key),
        set: this.setter(key, reset)
      })
    });
  }

  return new Pending(createReference) as any;
}

export function effectProperty<T = any>
  (value: any, effect?: EffectCallback<Controller, T>): T {

  if(!effect)
    effect = value,
    value = undefined;

  function registerEffect(this: Dispatch, key: string){
    const reset = createEffect(effect!);
    this.monitorValue(key, value, reset);
  }

  return new Pending(registerEffect) as any;
}

export function eventProperty
  (callback?: EffectCallback<Controller>){

  function registerEvent(this: Dispatch, key: string){
    this.register(key);
    this.override(key, {
      value: () => this.emit(key)
    })

    if(callback)
      this.effect(callback, [key]);
  }

  return new Pending(registerEvent) as any;
}

export function memoizedProperty
  (factory: () => any, defer?: boolean){

  function memoizeValue(this: Dispatch, key: string){
    const get = () => factory.call(this.subject);

    if(defer)
      defineLazy(this.subject, key, get);
    else
      define(this.subject, key, get())
  }
    
  return new Pending(memoizeValue) as any;
}

export function componentProperty
  (Type: ComponentType){

  const componentFor = createHocFactory(Type);

  function assignComponent(this: Dispatch, key: string){
    defineLazy(this.subject, key,
      () => componentFor(this.subject as Controller)
    )
  }
    
  return new Pending(assignComponent) as any;
}

export function parentComponentProperty
  (Type: ComponentType){

  const componentFor = createHocFactory(Type);

  function assignProvider(this: Dispatch, key: string){
    defineLazy(this.subject, key, () => {
      const control = this.subject as Controller;
      const Component = componentFor(control);
      return withProvider(Component, control)
    })
  }
    
  return new Pending(assignProvider) as any;
}

export function boundComponentProperty
  (Type: ControllableRefFunction<HTMLElement>, to: string){

  function createBinding(this: Dispatch, key: string){
    const control = this.subject as Controller;
    const Component = boundRefComponent(control, to, Type);
    define(control, key, Component);
  }
    
  return new Pending(createBinding) as any;
}

export function defineValueProperty(value: any){
  function setDefault(this: Dispatch, key: string){
    if(this.getters.has(key))
      return;
    else
      this.monitorValue(key, value);
  }

  return new Pending(setDefault, true) as any;
}

export function passiveProperty(value: any){
  function assign(this: Dispatch, key: string){
    within(this.subject, key, value);
  }

  return new Pending(assign);
}

export function tupleProperty<T extends any[]>
  (...values: T): T {

  if(values.length == 0)
    values = undefined as any;
  else if(values.length == 1 && typeof values[0] == "object")
    values = values[0] as any;
  
  function createTuple(this: Dispatch, key: string){
    const source = this.state;

    const setTuple = (next: any) => {
      const current: any = source[key];
      let update = false;

      if(!current){
        update = true;
        source[key] = current;
      }
      else 
        for(const k in current)
          if(current[k] !== next[k]){
            current[k] = next[k];
            update = true;
          }

      if(update)
        this.emit(key);
    }

    displayName(setTuple, `set ${key}`);

    source[key] = values;
    this.register(key);
    this.override(key, {
      get: this.getter(key),
      set: setTuple
    });
  }

  return new Pending(createTuple) as any;
}

type Async<T = any> = (...args: any[]) => Promise<T>;

export function actionProperty<F extends Async>(action: F){
  function createAction(this: Dispatch, key: string){
    let pending = false;

    const run = async (...args: any[]) => {
      if(pending)
        throw Oops.DuplicateAction(key);

      pending = true;
      this.emit(key);

      return action
        .apply(this.subject, args)
        .finally(() => {
          pending = false;
          this.emit(key);
        })
    }

    defineProperty(run, "allowed", {
      get: () => !pending
    })

    this.register(key);
    this.override(key, {
      get: () => pending ? undefined : run,
      set: Oops.SetActionProperty(key).warn
    });
  }

  return new Pending(createAction) as any;
}