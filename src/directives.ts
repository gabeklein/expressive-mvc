import type { ComponentType } from 'react';
import type { ControllableRefFunction } from '..';
import type { Controller, Model, State } from './controller';

import { boundRefComponent } from './components';
import { createHocFactory, withProvider } from './hoc';
import { Observer } from './observer';
import { Singleton } from './singleton';
import { define, defineLazy, defineProperty } from './util';

import Oops from './issues';

export class Placeholder {
  constructor(
    public applyTo: (recipient: Observer, key: string) => void
  ){}
}

export function childProperty<T extends Model>
  (Peer: T, callback?: (i: State<T>) => void): State<T> {

  function bindChild(on: Observer, key: string){
    const parent = on.subject;
    const instance = Peer.create();
    define(instance, { parent });
    define(parent, key, instance);
    if(callback)
      callback(instance);
  }

  return new Placeholder(bindChild) as any;
}

export function peerProperty<T extends Model>
  (Peer: T): State<T> {

  function bindSibling(on: Observer, key: string){
    const subject = on.subject as Controller;

    if(Singleton.isTypeof(Peer))
      defineLazy(subject, key, () => Peer.find());
    else if(subject instanceof Singleton)
      throw Oops.CantAttachGlobal(subject.constructor.name, Peer.name);
    else
      define(subject, key, Peer);
  }

  return new Placeholder(bindSibling) as any;
}

export function refProperty<T = any>
  (effect?: EffectCallback<Controller, any>): RefObject<T> {

  function createReference(on: Observer, key: string){
    const descriptor = on.access(key, effect);
    const value = defineProperty({}, "current", descriptor);

    defineProperty(on.subject, key, { value, enumerable: true });
  }

  return new Placeholder(createReference) as any;
}

export function effectProperty<T = any>
  (effect: EffectCallback<Controller, any>): T {

  function registerEffect(on: Observer, key: string){
    const descriptor = on.access(key, effect);

    defineProperty(on.subject, key, { ...descriptor, enumerable: true });
  }

  return new Placeholder(registerEffect) as any;
}

export function eventProperty
  (callback?: EffectCallback<Controller>){

  function registerEvent(on: Observer, key: string){
    const trigger = () => on.emit(key);

    on.monitorEvent(key, callback);
    defineProperty(on.subject, key, { value: trigger })
  }

  return new Placeholder(registerEvent) as any;
}

export function memoizedProperty
  (factory: () => any, defer?: boolean){

  function memoizeValue(on: Observer, key: string){
    const get = () => factory.call(on.subject);

    if(defer)
      defineLazy(on.subject, key, get);
    else
      define(on.subject, key, get())
  }
    
  return new Placeholder(memoizeValue) as any;
}

export function componentProperty
  (Type: ComponentType){

  const componentFor = createHocFactory(Type);

  function assignComponent(on: Observer, key: string){
    defineLazy(on.subject, key, () => {
      return componentFor(on.subject as Controller)
    })
  }
    
  return new Placeholder(assignComponent) as any;
}

export function parentComponentProperty
  (Type: ComponentType){

  const componentFor = createHocFactory(Type);

  function assignProvider(on: Observer, key: string){
    defineLazy(on.subject, key, () => {
      const control = on.subject as Controller;
      const Component = componentFor(control);
      return withProvider(Component, control)
    })
  }
    
  return new Placeholder(assignProvider) as any;
}

export function boundComponentProperty
  (Type: ControllableRefFunction<HTMLElement>, to: string){

  function createBinding(on: Observer, key: string){
    const control = on.subject as Controller;
    const Component = boundRefComponent(control, to, Type);
    define(control, key, Component);
  }
    
  return new Placeholder(createBinding) as any;
}