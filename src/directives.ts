import type { Controller, Model } from './controller';

import { Observer } from './observer';
import { Singleton } from './singleton';
import { define, defineLazy, defineProperty } from './util';

import Oops from './issues';

export class Placeholder {
  constructor(
    public applyTo: (recipient: Observer, as: string) => void
  ){}

  static is(fn: (on: Observer, key: string) => void){
    return new this(fn) as any;
  }
}

export function getPeerHelper<T extends Model>
  (Peer: T): InstanceType<T> {

  return Placeholder.is((on: Observer, as: string) => {
    const subject = on.subject as Controller;

    if(Singleton.isTypeof(Peer))
      defineLazy(subject, as, () => Peer.find());
    else if(subject instanceof Singleton)
      throw Oops.CantAttachGlobal(subject.constructor.name, Peer.name);
    else
      define(subject, as, Peer);
  })
}

export function setRefHelper<T = any>
  (effect?: EffectCallback<Controller, any>): RefObject<T> {

  return Placeholder.is((on: Observer, as: string) => {
    const descriptor = on.access(as, effect);

    defineProperty(on.subject, as, {
      enumerable: true,
      value: defineProperty({}, "current", descriptor)
    });
  })
}

export function setPropertyHelper<T = any>
  (effect: EffectCallback<Controller, any>): T {

  return Placeholder.is((on: Observer, as: string) => {
    const descriptor = on.access(as, effect);

    defineProperty(on.subject, as, {
      enumerable: true,
      ...descriptor
    });
  })
}