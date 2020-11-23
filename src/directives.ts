import type { Controller, Model, State } from './controller';

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

    defineProperty(on.subject, key, {
      enumerable: true,
      value: defineProperty({}, "current", descriptor)
    });
  }

  return new Placeholder(createReference) as any;
}

export function effectProperty<T = any>
  (effect: EffectCallback<Controller, any>): T {

  function registerEffect(on: Observer, key: string){
    const descriptor = on.access(key, effect);

    defineProperty(on.subject, key, {
      enumerable: true,
      ...descriptor
    });
  }

  return new Placeholder(registerEffect) as any;
}

export function eventProperty
  (callback?: EffectCallback<Controller>){

  function registerEvent(on: Observer, key: string){
    on.monitorEvent(key, callback);
    defineProperty(on.subject, key, {
      value: () => on.emit(key)
    })
  }

  return new Placeholder(registerEvent) as any;
}

export function memoizedProperty
  (factory: () => any){

  function memoizeValue(on: Observer, key: string){
    defineProperty(on.subject, key, {
      value: factory.call(on.subject)
    })
  }
    
  return new Placeholder(memoizeValue) as any;
}