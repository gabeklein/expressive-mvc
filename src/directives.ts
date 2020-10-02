import { Controller } from "./controller";
import { Observer } from "./observer";

const define = Object.defineProperty;

type RefObject<T = any> = { current: T };

export class Placeholder {
  constructor(
    public applyTo: (recipient: Observer, as: string) => void
  ){}
}

export function getPeerHelper<T extends typeof Controller>
  (Model: T): InstanceType<T> {

  return new Placeholder(
    function findNearest(on: Observer, key: string){
      (on.subject as Controller).attach(key, Model);
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