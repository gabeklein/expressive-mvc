import { Control, control, controller } from './control';
import { issues } from './helper/issues';
import { defineProperty } from './helper/object';
import { Callback } from './helper/types';
import { Model } from './model';
import { Subscriber, subscriber } from './subscriber';

export const Parent = new WeakMap<{}, {}>();

export const Oops = issues({
  BadAssignment: (parent, expected, got) =>
    `Property ${parent} expected Model of type ${expected} but got ${got}.`
})

export function getRecursive(key: string, from: Control){
  const context = new WeakMap<Subscriber, {} | undefined>();
  const { state } = from;

  return (local: Subscriber | undefined) => {
    if(!local)
      return state.get(key);

    if(!context.has(local)){
      let reset: Callback | undefined;

      const init = () => {
        if(reset)
          reset();

        const value = state.get(key);
  
        if(controller(value)){
          const child = control(value).subscribe(local.onUpdate);
  
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

        return true;
      }
  
      local.add(key, init);
      init();
    }

    return context.get(local);
  }
}

export function setRecursive(
  controller: Control, key: string, initial: Model){

  const { state, subject } = controller;
  const Type = initial.constructor;

  let get: (local: Subscriber | undefined) => any

  const onUpdate = (next: {} | undefined) => {
    state.set(key, next);

    if(!(next instanceof Type))
      throw Oops.BadAssignment(`${subject}.${key}`, Type.name, String(next));

    get = getRecursive(key, controller);
    Parent.set(next, subject);
    control(next);

    return true;
  }

  onUpdate(initial);

  defineProperty(subject, key, {
    set: controller.ref(key, onUpdate),
    get(this: Model){
      const local = subscriber(this);

      if(local)
        local.add(key);

      return get(local);
    }
  });
}