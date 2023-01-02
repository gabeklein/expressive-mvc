import { Model } from "./model";
import { Control } from "./control";
import { Subscriber } from "./subscriber";
import { getPrototypeOf } from "./util";

export const WHY = Symbol("UPDATE");
export const LOCAL = Symbol("LOCAL");
export const STATE = Symbol("STATE");
export const CONTROL = Symbol("CONTROL");

export const UPDATE = new WeakMap<{}, readonly string[]>();

export function apply(control: Control){
  Object.defineProperties(control.subject, {
    [Debug.CONTROL]: {
      value: control
    },
    [Debug.STATE]: {
      get: () => {
        const output: any = {};
        control.state.forEach((value, key) => output[key] = value);
        return output;
      }
    },
    [Debug.WHY]: {
      get(this: any){
        return getUpdate(this);
      }
    }
  })
}

export function getUpdate<T extends {}>(subject: T){
  return UPDATE.get(subject) as readonly Model.Event<T>[];
}

export function setUpdate(subject: any, keys: Set<string>){
  UPDATE.set(subject, Array.from(keys));
  setTimeout(() => UPDATE.delete(subject), 0);
}

/** Ensure a local update is dropped after use. */
export function hasUpdate(proxy: any){
  if(UPDATE.has(proxy))
    setTimeout(() => UPDATE.delete(proxy), 0);
}

/** Set local update for a subscribed context. */
export function addUpdate(proxy: any, using: Map<string, any>){
  const parent = UPDATE.get(getPrototypeOf(proxy))!;

  UPDATE.set(proxy, parent.filter(k => using.has(k)));
}

const Debug = { CONTROL, LOCAL, STATE, WHY } as const;

type Debug<T extends {}> = T & {
  /** Controller for this instance. */
  [CONTROL]?: Control<T>;

  /** Current subscriber (if present) while used in a live context (e.g. hook or effect). */
  [LOCAL]?: Subscriber<T>;

  /** Current state of this instance. */
  [STATE]?: Model.Values<T>;

  /**
   * Last update causing a refresh to subscribers.
   * 
   * If accessed directly, will contain all keys from last push.
   * If within a subscribed function, will contain only keys which explicitly caused a refresh.
   */
  [WHY]?: readonly Model.Event<T>[];
}

export { Debug };