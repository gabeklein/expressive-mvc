import { Controller } from "./controller";
import { Observer } from "./observer";
import { Singleton } from "./singleton";
import { defineAtNeed, Issues } from "./util";

const define = Object.defineProperty;
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
}

export function getPeerHelper<T extends typeof Controller>
  (Peer: T): InstanceType<T> {

  return new Placeholder(
    function findNearest(on: Observer, key: string){
      const subject = on.subject as Controller;
  
      if(Singleton.isTypeof(Peer))
        defineAtNeed(subject, key, () => Peer.find());
      else
      if(subject instanceof Singleton)
        throw Oops.CantAttach(subject.constructor.name, Peer.name);
    }
  ) as any;
}

export function setRefHelper<T = any>
  (onNewValue?: EffectCallback): RefObject<T> {

  return new Placeholder(
    function manageRef(parent: Observer, key: string){
      const descriptor = parent.access(key, onNewValue);
  
      define(parent.subject, key, {
        enumerable: true,
        value: define({}, "current", descriptor)
      });
    }
  ) as any;
}

export function setPropertyHelper<T = any>
  (onNewValue: EffectCallback): T {

  return new Placeholder(
    function manageValue(parent: Observer, key: string){
      const descriptor = parent.access(key, onNewValue);
  
      define(parent.subject, key, {
        enumerable: true,
        ...descriptor
      });
    }
  ) as any;
}