import { Controller } from "./controller";
import { Observer } from "./observer";

const define = Object.defineProperty;

type RefObject<T = any> = { current: T };

export class Placeholder {
  constructor(
    public applyTo: (recipient: Observer, as: string) => void
  ){}
}

export function getPeerHelper
  <T extends typeof Controller>
  (Model: T): InstanceType<T> {

  function findNearest(on: Observer, key: string){
    (on.subject as Controller).attach(key, Model);
  }

  return new Placeholder(findNearest) as any;
}

export function setRefHelper<T = any>
  (onNewValue?: EffectCallback): RefObject<T> {

  function manageRef(parent: Observer, key: string){
    const desc = parent.accessor(key, onNewValue);

    define(parent.subject, key, {
      enumerable: true,
      value: define({}, "current", desc)
    });
  }

  return new Placeholder(manageRef) as any;
}

export function setPropertyHelper<T = any>
  (onNewValue: EffectCallback): T {

  function manageValue(parent: Observer, key: string){
    const desc = parent.accessor(key, onNewValue);

    define(parent.subject, key, {
      enumerable: true,
      ...desc
    });
  }

  return new Placeholder(manageValue) as any;
}