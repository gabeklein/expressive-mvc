import { add, Model } from '@expressive/mvc';

import { expect, RegisterCallback } from './useContext';

export function has <T extends Model> (type: Model.Type<T>, one: true): T;
export function has <T extends Model> (type: Model.Type<T>, required: boolean): T | undefined;
export function has <T extends Model> (type: Model.Type<T>, arg?: RegisterCallback<T>): Set<T>;
  
export function has <T extends Model> (
  type: Model.Type<T>,
  argument?: boolean | RegisterCallback<T>){

  return add<T>((key, subject, state) => {
    if(typeof argument == "boolean"){
      expect(subject, type, (model: T) => {
        // if(state[key])
        //   throw new Error(`Tried to register new ${model.constructor} in ${subject}.${key} but one already exists.`);
        
        subject.set(key as any, model);
  
        model.get(null, () => {
          if(state[key] === model)
            delete state[key];
        })
      })

      return { get: argument }
    }

    const children = new Set<T>();
  
    expect(subject, type, (model: T) => {
      if(children.has(model))
        return;

      const remove = typeof argument == "function"
        ? argument(model)
        : undefined;

      if(remove === false)
        return;

      children.add(model);
      subject.set(key);

      model.get(null, () => {
        if(typeof remove == "function")
          remove();

        children.delete(model);
        subject.set(key);
      })
    });

    return {
      value: children
    }
  })
}