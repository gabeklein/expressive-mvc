import { Controller } from './controller';
import { Observer } from './observer';
import { Singleton } from './singleton';
import { defineAtNeed, defineProperty, Issues } from './util';

const Oops = Issues({
  CantAttach: (parent, child) =>
    `Singleton '${parent}' attempted to attach '${child}'. ` +
    `This is not possible because '${child}' is not also a singleton.`,
})

type RefObject<T = any> = { current: T };

export class Placeholder {
  constructor(
    public applyTo: (recipient: Observer, as: string) => void
  ){}

  static is(fn: (on: Observer, key: string) => void){
    return new this(fn) as any;
  }
}

export function getPeerHelper<T extends typeof Controller>
  (Peer: T): InstanceType<T> {

  return Placeholder.is((on: Observer, as: string) => {
    const subject = on.subject as Controller;

    if(Singleton.isTypeof(Peer))
      defineAtNeed(subject, as, () => Peer.find());
    else
    if(subject instanceof Singleton)
      throw Oops.CantAttach(subject.constructor.name, Peer.name);
  })
}

export function setRefHelper<T = any>
  (effect?: EffectCallback): RefObject<T> {

  return Placeholder.is((on: Observer, as: string) => {
    const descriptor = on.access(as, effect);

    defineProperty(on.subject, as, {
      enumerable: true,
      value: defineProperty({}, "current", descriptor)
    });
  })
}

export function setPropertyHelper<T = any>
  (effect: EffectCallback): T {

  return Placeholder.is((on: Observer, as: string) => {
    const descriptor = on.access(as, effect);

    defineProperty(on.subject, as, {
      enumerable: true,
      ...descriptor
    });
  })
}