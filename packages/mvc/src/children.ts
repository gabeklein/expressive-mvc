import { Control, control, controller } from './control';
import { issues } from './helper/issues';
import { Callback } from './helper/types';
import { Model } from './model';
import { Subscriber } from './subscriber';

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

  return (local?: Subscriber) => {
    if(!local)
      return state.get(key);

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
  controller: Control, key: string, initial: Model){

  const { state, subject } = controller;
  const Type = initial.constructor;

  const get = getRecursive(key, controller);
  const set = (next: Model | undefined) => {
    if(next instanceof Type){
      state.set(key, next);
      Parent.set(next, subject);
      control(next);
      return true;
    }

    throw Oops.BadAssignment(`${subject}.${key}`, Type, next);
  }

  set(initial);
  
  return { get, set } as Control.Instruction.Descriptor<any>;
}