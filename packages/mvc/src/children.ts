import { Control, control, controller, detectAccess, Observer } from './control';
import { issues } from './helper/issues';
import { Model } from './model';
import { Subscriber } from './subscriber';

import type { Callback } from '../types';

export const Parent = new WeakMap<{}, {}>();

export const Oops = issues({
  BadAssignment: (parent, expected, got) =>
    `${parent} expected Model of type ${expected} but got ${got}.`,

  Unexpected: (expects, child, got) =>
    `New ${child} created as child of ${got}, but must be instanceof ${expects}.`,
})

export function getParent<T extends Model>(
  from: Model,
  type?: Model.Class<T>){

  const value = Parent.get(from) as T;

  if(value && type && !(value instanceof type))
    throw Oops.Unexpected(type, from, value);

  return value;
}

export function getRecursive(key: string, from: Control){
  const context = new WeakMap<Subscriber, {} | undefined>();
  const { state } = from;

  return (local?: Subscriber, observer?: Observer) => {
    if(!local){
      const value = state.get(key);

      return observer && value instanceof Model
        ? detectAccess(value, observer)
        : value;
    }

    if(!context.has(local)){
      let reset: Callback | undefined;

      const init = () => {
        if(reset)
          reset();

        const value = state.get(key);
  
        if(value && controller(value)){
          const child = new Subscriber(value, local.onUpdate);
  
          if(local.active)
            child.commit();
  
          local.dependant.add(child);
          context.set(local, child.proxy);

          reset = () => {
            child.release();
            local.dependant.delete(child);
            context.set(local, undefined);
            reset = undefined;
          }
        }
      }
  
      local.follow(key, init);
      init();
    }

    return context.get(local);
  }
}

export function setRecursive(
  on: Control, key: string, initial: Model
): Control.Instruction.Descriptor {

  const expected = initial.constructor;
  const get = getRecursive(key, on);
  const set = (next: Model | undefined) => {
    if(next instanceof expected){
      on.state.set(key, next);
      Parent.set(next, on.subject);
      control(next);
      return true;
    }

    throw Oops.BadAssignment(`${on.subject}.${key}`, expected, next);
  }

  set(initial);
  
  return { get, set };
}