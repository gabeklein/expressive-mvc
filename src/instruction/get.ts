import { Controller, ensure } from '../controller';
import { issues } from '../issues';
import { Stateful } from '../model';
import { Subscriber } from '../subscriber';
import { suspend } from '../suspense';
import { Callback } from '../types';
import { apply } from './apply';

export const Oops = issues({
  BadSource: (model, property, got) =>
    `Bad from-instruction provided to ${model}.${property}. Expects an arrow-function or a Model as source. Got ${got}.`,

  PeerNotAllowed: (model, property) =>
    `Attempted to use an instruction result (probably use or tap) as computed source for ${model}.${property}. This is not possible.`,

  Failed: (parent, property, initial) =>
    `An exception was thrown while ${initial ? "initializing" : "refreshing"} [${parent}.${property}].`
});

type GetterInfo = {
  key: string;
  parent: Controller;
}

const INFO = new WeakMap<Function, GetterInfo>();
const KEYS = new WeakMap<Controller, Callback[]>();
const ORDER = new WeakMap<Controller, Callback[]>();

declare namespace get {
  type Function<T, O=any> = (this: O, on: O) => T;
  type Factory<T, O=any> = (key: string) => Function<T, O>;
  type Getter = (controller: Controller, key: string) => any;
}

/**
 * Implement a computed value; output will be generated by provided function.
 *
 * @param source - Source model from which computed value will be a subscriber.
 * @param compute - Compute function. Bound to a subscriber-proxy of source, returns output value. Will update automatically as input values change.
 * @param suspend - Value will throw suspense when evaulating to undefined.
 */
function get <R, T> (source: T, compute: (this: T, on: T) => R, suspend: true): Exclude<R, undefined>;
function get <R, T> (source: T, compute: (this: T, on: T) => R, suspend?: boolean): R;

/**
 * Implement a computed value; output is returned by function from provided factory.
 *
 * @param compute - Factory function to generate a getter to subscribe dependancies.
 * @param suspend - Value will throw suspense when evaulating to undefined.
 */
function get <R, T> (compute: (property: string) => (this: T, state: T) => R, suspend: true): Exclude<R, undefined>;
function get <R, T> (compute: (property: string) => (this: T, state: T) => R, suspend?: boolean): R;

function get<R, T>(
  source: get.Factory<T> | Stateful,
  arg1?: get.Function<T> | boolean,
  arg2?: boolean): R {

  return apply(
    function get(key){
      const { subject, state } = this;
      const required = arg2 === true || arg1 === true;

      let getSource: () => Controller;

      if(typeof arg1 == "boolean")
        arg1 = undefined;

      // Easy mistake, using a peer, will always be unresolved.
      if(typeof source == "symbol")
        throw Oops.PeerNotAllowed(subject, key);

      // replace source controller in-case it is different
      if(typeof source == "object")
        getSource = () => ensure(source);

      // specifically an arrow function (getter factory)
      else if(!source.prototype){
        arg1 = source.call(subject, key);
        getSource = () => this;
      }

      // Regular function is too ambiguous so not allowed.
      else
        throw Oops.BadSource(subject, key, source);

      const setter = arg1;
      const info: GetterInfo = { key, parent: this };

      let sub: Subscriber;
      let order = ORDER.get(this)!;

      if(!order)
        ORDER.set(this, order = []);

      const compute = (initial: boolean) => {
        try {
          return setter!.call(sub.proxy, sub.proxy);
        }
        catch(err){
          Oops.Failed(subject, key, initial).warn();
          throw err;
        }
      }

      const refresh = () => {
        let value;

        try {
          value = compute(false);
        }
        catch(e){
          console.error(e);
        }
        finally {
          if(state.get(key) !== value){
            state.set(key, value);
            this.update(key);
            return value;
          }
        }
      }

      const update = (_key: any, source: Controller) => {
        if(source !== this){
          refresh();
          return;
        }

        let pending = KEYS.get(this);

        if(!pending)
          KEYS.set(this, pending = []);

        pending.push(refresh);
      }

      const create = () => {
        sub = getSource().subscribe(update);

        try {
          const value = compute(true);
          state.set(key, value);
          return value;
        }
        catch(e){
          throw e;
        }
        finally {
          sub.commit();
          order.push(refresh);
        }
      }

      state.set(key, undefined);
      INFO.set(refresh, info);

      return () => {
        const value = sub ? state.get(key) : create();

        if(value === undefined && required)
          throw suspend(this, key);

        return value;
      }
    }
  )
}

export function flush(control: Controller){
  const pending = KEYS.get(control);

  if(!pending)
    return;

  const list = ORDER.get(control)!;

  while(pending.length){
    const compute = pending
      .sort((a, b) => list.indexOf(b) - list.indexOf(a))
      .pop()!

    const { key } = INFO.get(compute)!;

    if(!control.frame.has(key))
      compute();
  }

  KEYS.delete(control);
}

export { get }