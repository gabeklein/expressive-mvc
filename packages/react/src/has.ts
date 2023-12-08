import { Context, add } from '@expressive/mvc';

import { Model } from '.';

type RegisterCallback<T = any> = (model: T) => void | boolean | (() => void);

const Expects = new WeakMap<Model, Map<Model.Type, RegisterCallback>>();

export function has <T extends Model> (type: Model.Type<T>, one: true): T;
export function has <T extends Model> (type: Model.Type<T>, required: boolean): T | undefined;
export function has <T extends Model> (type: Model.Type<T>, arg?: RegisterCallback<T>): Set<T>;
  
export function has <T extends Model> (
  type: Model.Type<T>,
  argument?: boolean | RegisterCallback<T>){

  return add<T>((key, subject, state) => {
    let map = Expects.get(subject);
  
    if(!map)
      Expects.set(subject, map = new Map());

    if(typeof argument == "boolean"){
      map.set(type, (model: T) => {
        // if(state[key])
        //   throw new Error(`Tried to register new ${model.constructor} in ${subject}.${key} but one already exists.`);
        
        subject.set(key as any, model);
  
        model.get(null, () => {
          if(state[key] === model)
            delete state[key];
        })
      });

      return { get: argument }
    }

    const children = new Set<T>();
  
    map.set(type, (model: T) => {
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

export function inject(model: Model, context: Context){
  const expects = Expects.get(model);

  if(expects)
    for(let [T, callback] of expects)
      context.put(T as Model.New, callback);
}